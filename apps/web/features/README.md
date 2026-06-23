# apps/web/features

사용자 사이트의 **기능 단위(feature) 모듈**을 둡니다. 예: `posts/`, `questions/`, `resources/`, `auth/`.

각 feature 폴더는 해당 기능의 페이지 전용 컴포넌트·훅·데이터 접근을 모읍니다. 공통 UI 는 `components/ui`,
도메인 규칙은 `@ai-jakdang/core`, API 타입은 `@ai-jakdang/contracts` 를 사용합니다.

> 이번 기반 단계에서는 개별 서비스 기능을 구현하지 않으므로 비어 있습니다.
