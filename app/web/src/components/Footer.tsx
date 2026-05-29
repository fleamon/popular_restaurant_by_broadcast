import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-neutral-100 py-6 text-center text-xs text-neutral-400">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} 백안맛지도</span>
        <Link href="/about" className="hover:text-neutral-600">소개</Link>
        <a href="/privacy" className="hover:text-neutral-600">개인정보처리방침</a>
        <a href="mailto:fleabackx@gmail.com" className="hover:text-neutral-600">문의</a>
      </div>
    </footer>
  );
}
