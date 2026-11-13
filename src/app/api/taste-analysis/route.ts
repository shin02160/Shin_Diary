import { authorize, errorResponse, json, readJson, sameOrigin } from '@/lib/server/auth';
import { AppError, getConfig } from '@/lib/server/config';
import { analysisInstructions, analysisPrompt, readSuggestions, validAnalysisRequest } from '@/lib/taste-analysis';

export const maxDuration = 60;
const settings = () => ({
 key: process.env.OPENAI_API_KEY?.trim(),
 model: process.env.OPENAI_TASTE_MODEL?.trim() || process.env.OPENAI_REVIEW_MODEL?.trim(),
});
let availableAt = 0;

export function GET(request: Request) {
 try {
  authorize(request, getConfig());
  const { key, model } = settings();
  return json({ enabled: Boolean(key && model) });
 } catch (error) { return errorResponse(error); }
}

// Suggests traits for sentences the writer already wrote. The answer is filtered before it leaves the server:
// only sentence numbers that were sent are accepted, so no quote can be made up.
export async function POST(request: Request) {
 try {
  const config = getConfig();
  sameOrigin(request, config);
  authorize(new Request(request.url, { headers: request.headers }), config);
  const { key, model } = settings();
  if (!key || !model) throw new AppError(503, 'AI 특성 제안이 설정되지 않았어요.');
  const body = await readJson(request, 64_000);
  if (!validAnalysisRequest(body)) throw new AppError(400, '전송 자료를 확인해 주세요.');
  const delay = Math.ceil((availableAt - Date.now()) / 1000);
  if (delay > 0) throw new AppError(429, '잠시 후 다시 요청해 주세요.', delay);
  availableAt = Date.now() + 40_000;
  try {
   const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(50_000),
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
     model, store: false, max_output_tokens: 6000, text: { format: { type: 'json_object' } },
     instructions: analysisInstructions, input: analysisPrompt(body.sentences, body.vocabulary),
    }),
   });
   if (!response.ok) throw new Error();
   const result = await response.json() as {
    status?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
   };
   const text = result.output?.filter(item => item.type === 'message').flatMap(item => item.content ?? [])
    .filter(item => item.type === 'output_text').map(item => item.text ?? '').join('').trim();
   if (result.status !== 'completed' || !text) throw new Error();
   return json({ ...readSuggestions(text, body.sentences), generatedAt: new Date().toISOString(), sent: body.sentences.length });
  } catch {
   throw new AppError(502, '특성 제안을 받지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
 } catch (error) { return errorResponse(error); }
}
