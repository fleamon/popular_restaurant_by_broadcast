export const metadata = { title: "소개 · 백안맛지도" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-brand">이 사이트를 만든 사람</h1>
      <p className="text-neutral-700 leading-relaxed">
        안녕하세요, <strong>백안맛지도</strong> 를 만든 1인 개발자입니다. 전국의 방송·유튜브에 소개된 맛집을
        가장 가독성 좋게 볼 수 있는 지도를 만들고 싶어 이 프로젝트를 시작했습니다.
      </p>

      <section className="rounded-xl border border-neutral-200 bg-brand-surface p-4">
        <h2 className="font-semibold mb-2">개발자 후원</h2>
        <p className="text-sm text-neutral-600 mb-3">서버/도메인 비용에 큰 힘이 됩니다 🙇‍♀️</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href="https://www.buymeacoffee.com/CHANGE_ME"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-brand px-3 py-2 text-brand-fg hover:bg-brand-hover"
          >
            ☕ 커피 사주기
          </a>
          <a
            href="https://toss.me/CHANGE_ME"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-brand px-3 py-2 text-brand hover:bg-white"
          >
            💙 토스로 후원
          </a>
          <a
            href="https://qr.kakaopay.com/CHANGE_ME"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-brand px-3 py-2 text-brand hover:bg-white"
          >
            🟡 카카오페이 QR
          </a>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          위 링크는 플레이스홀더입니다. 실제 URL은 <code>src/app/about/page.tsx</code> 에서 수정하세요.
        </p>
      </section>

      <section className="text-sm text-neutral-500">
        <p>
          소스코드는{" "}
          <a href="https://github.com/CHANGE_ME/popular_restaurant_by_broadcast" className="text-brand underline">
            GitHub
          </a>
          에서 확인할 수 있습니다. 피드백 환영합니다.
        </p>
      </section>
    </div>
  );
}
