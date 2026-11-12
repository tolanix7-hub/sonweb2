# 내 차 도우미: 주유소 최저가 · 전기차 충전소 · 세차 날씨 올리는 방법

## 1. 파일을 GitHub 저장소(sonweb2)에 올리기

저장소 맨 위에 아래 구조 그대로 올립니다. `functions` 폴더 위치가 바뀌면 동작하지 않습니다.

```
index.html
functions/
  api/
    fuel.js
    evstat.js
scripts/
  build-ev.mjs
.github/
  workflows/
    ev-data.yml
```

GitHub 웹에서는 **Add file → Upload files**로 압축을 푼 `functions`, `scripts` 폴더를 끌어다 놓으면 됩니다.

`.github` 폴더는 점(.)으로 시작해 컴퓨터에서 숨겨져 있어 끌어다 놓기가 안 될 수 있습니다. 그럴 때는 **Add file → Create new file**을 누르고, 파일 이름 칸에 `.github/workflows/ev-data.yml`을 그대로 적은 뒤 `ev-data.yml` 내용을 붙여 넣고 저장하세요.

## 2. Cloudflare Pages에 오피넷 키 넣기

1. Cloudflare 대시보드 → **Workers & Pages** → 연결한 프로젝트를 엽니다.
2. **Settings → Variables and Secrets**(또는 Environment variables)에서 **Add**를 누릅니다.
3. 이름은 `OPINET_KEY`, 값은 오피넷에서 받은 키를 넣습니다. 종류는 **Secret(암호화)**를 고릅니다.
4. 저장한 뒤 **Deployments**에서 최신 배포를 **Retry deployment**(재배포)합니다. 재배포해야 키가 적용됩니다.

같은 방법으로 이름 `EV_KEY`, 값에 공공데이터포털 '한국환경공단 전기자동차 충전소 정보' 키를 하나 더 넣습니다(충전소 빈 자리용).

키는 어떤 파일에도 직접 적지 마세요. 공개 저장소에 올라가면 누구나 볼 수 있습니다.

## 3. GitHub에 충전소 키 넣고 목록 처음 받기

충전소 목록은 GitHub이 하루 한 번(새벽 3시 17분) 받아서 `ev` 폴더에 저장합니다. 저장되면 Cloudflare가 알아서 다시 배포합니다.

1. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
2. 이름 `EV_KEY`, 값에 공공데이터포털 키를 넣고 저장합니다.
3. 저장소 위쪽 **Actions** 탭 → 왼쪽 **전기차 충전소 목록 갱신** → **Run workflow**를 눌러 처음 한 번 바로 실행합니다.
4. 몇 분 뒤 초록 체크가 뜨고 저장소에 `ev` 폴더가 생기면 성공입니다. 빨간 X가 뜨면 눌러서 나오는 오류 문구를 알려 주세요.

## 4. 확인하기

- Cloudflare가 준 주소(`프로젝트이름.pages.dev`)로 접속합니다. GitHub Pages 주소(`github.io`)에서는 서버 코드가 돌지 않아 주유소 가격이 나오지 않습니다.
- 브라우저에서 `프로젝트이름.pages.dev/api/fuel?lat=36.12&lon=128.34` 를 열면 주변 주유소 목록(JSON)이 보여야 합니다.
  - `서버에 오피넷 키가 설정되지 않았어요` → 2번의 변수 이름이나 재배포를 확인합니다.
  - `오피넷 응답 오류` → 키가 맞는지, 오피넷에서 키 사용 승인이 났는지 확인합니다.
- `프로젝트이름.pages.dev/ev/_info.json` 을 열면 충전소 수와 기준일이 보여야 합니다(3번을 마친 뒤).

## 동작 방식

- **주유소 최저가:** 페이지가 `/api/fuel`에 위치를 보내면, Cloudflare의 `fuel.js`가 오피넷 키로 반경 5km 주유소를 받아 싼 순서 10곳을 돌려줍니다. 같은 동네(약 1km)는 10분 동안 같은 결과를 씁니다.
- **세차 날씨:** 키 없이 페이지에서 오픈메테오 예보를 바로 받아 옵니다.
- **전기차 충전소:** 가까운 충전소 목록은 `ev` 폴더의 파일(하루 한 번 갱신)에서 찾고, 빈 자리는 `/api/evstat`가 볼 때마다 공공데이터포털에서 받아 옵니다(2분 캐시).
- **블루핸즈:** 지금은 네이버지도로 연결합니다.
