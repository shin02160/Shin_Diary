import { parseIcs } from './ics-parser.mjs';
self.onmessage=({data})=>{
 try{self.postMessage({ok:true,result:parseIcs(data.text,data.options)});}
 catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:'ICS 파일을 읽지 못했습니다.'});}
};
