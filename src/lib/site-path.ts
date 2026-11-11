export function safeSitePath(value?: string | null) {
 if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/';
 const parsed = new URL(value, 'https://diary.invalid');
 if (parsed.origin !== 'https://diary.invalid' || parsed.pathname === '/unlock' || parsed.pathname.startsWith('/api/')) return '/';
 return parsed.pathname + parsed.search;
}
