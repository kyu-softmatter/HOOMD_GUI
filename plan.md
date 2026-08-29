# HOOMD GUI 구현 계획

> 이 문서는 구현 순서와 완료 기준을 정리한 한글 작업 계획서다. 제품 개념과 장기 기능 범위는 `readme.md`를 기준으로 한다.

## 0. 개발 언어 규칙

이 프로젝트에서는 다음 규칙을 반드시 지킨다.

- `plan.md`는 한글로 작성한다.
- 모든 소스 코드는 영어로 작성한다.
- 변수명, 함수명, 클래스명, 모듈명, 파일명은 영어로 작성한다.
- 모든 코드 주석과 docstring은 영어로 작성한다.
- 오류 메시지, 로그 메시지, 테스트 이름과 assertion 메시지는 영어로 작성한다.
- API 필드명과 JSON 키는 영어로 작성한다.
- 기본 UI 문구와 접근성 레이블은 영어로 작성한다.
- 개발자용 기술 문서와 커밋 메시지는 영어로 작성한다.
- 한글은 이 계획서와 향후 명시적으로 요청된 사용자용 번역에만 사용한다.
- 코드에 한글 주석을 추가하지 않는다.

예시:

```python
def calculate_pair_force(distance: float) -> float:
    """Return the radial force at the given distance."""
    return 0.0
```

## 1. 개발 환경과 가상환경 설정

첫 번째 작업은 애플리케이션 코드를 작성하는 것이 아니라 재현 가능한 개발환경을 만드는 것이다.

### 1.1 환경 관리 방식

HOOMD-blue 공식 바이너리는 conda-forge를 통해 Pixi, Micromamba 또는 Mamba로 설치할 수 있다. 초기 구현에서는 환경 정의와 lockfile 관리가 간단한 **Pixi를 우선 선택**한다.

- 초기 HOOMD-blue 대상 버전: `7.1.2`
- 초기 실행 대상: macOS ARM64 CPU
- Python 후보 버전: `3.12`
- GPU 환경은 CPU 환경이 안정화된 이후 별도 profile로 추가한다.
- 일반적인 `python -m venv`만으로 HOOMD-blue를 설치하려 하지 않는다.
- HOOMD-blue와 네이티브 의존성은 conda-forge 패키지로 관리한다.
- Python 패키지 메타데이터와 자체 코어 패키지는 `pyproject.toml`로 관리한다.

공식 설치 참고 문서:

- <https://hoomd-blue.readthedocs.io/en/latest/installation.html>

### 1.2 생성할 파일

```text
HOOMD_GUI/
|- pixi.toml
|- pixi.lock
|- pyproject.toml
|- .gitignore
|- scripts/
|  `- check_environment.py
|- python/
|  `- hoomd_gui_core/
|     `- __init__.py
`- tests/
   `- test_environment.py
```

### 1.3 초기 환경 의존성

필수 런타임 후보:

- `python`
- `hoomd`
- `numpy`
- `pydantic`
- `fastapi`
- `uvicorn`

개발 도구 후보:

- `pytest`
- `ruff`
- `mypy`
- `httpx`

초기 단계에서는 필요한 패키지만 추가하며, 프런트엔드 빌드 도구는 설치하지 않는다.

### 1.4 환경 확인 스크립트

`scripts/check_environment.py`는 다음 정보를 영어로 출력해야 한다.

- Python 버전
- 운영체제와 CPU 아키텍처
- HOOMD-blue 버전
- CPU/GPU 장치 생성 가능 여부
- 설치된 핵심 패키지 버전
- 프로젝트 코어 패키지 import 가능 여부

민감한 경로나 환경변수 전체를 로그로 출력하지 않는다.

### 1.5 1단계 완료 기준

- 새 checkout에서 한 명령으로 환경을 설치할 수 있다.
- lockfile이 생성되고 Git에 포함된다.
- `hoomd` import가 성공한다.
- 간단한 CPU `Simulation` 객체를 생성할 수 있다.
- `pytest`가 실행된다.
- `ruff`와 `mypy`가 실행된다.
- 환경 확인 스크립트가 실패 원인을 영어로 설명한다.
- 설치와 검증 명령이 `readme.md`에 추가된다.

## 2. Python 코어 골격

웹 UI보다 먼저 물리 모델과 프로젝트 데이터를 표현하는 Python 코어를 만든다.

### 2.1 패키지 구조

```text
python/hoomd_gui_core/
|- __init__.py
|- models/
|  |- project.py
|  |- box.py
|  |- particle.py
|  |- interaction.py
|  `- run.py
|- validation/
|  |- issues.py
|  `- project_validator.py
|- interactions/
|  |- builtins.py
|  |- expressions.py
|  `- tables.py
|- compiler/
|  `- hoomd_script.py
|- geometry/
|  `- generators.py
`- serialization/
   `- project_json.py
```

### 2.2 최소 데이터 모델

첫 번째 스키마에는 다음 항목만 포함한다.

- 프로젝트 이름과 schema version
- 2D/3D simulation box
- 입자 타입
- 입자 위치와 직경
- display layer
- A-A, A-B, B-B pair interaction
- `dt`, `kT`, step 수
- device preference
- trajectory와 log 저장 주기

### 2.3 핵심 원칙

- UI 상태가 아니라 과학적 프로젝트 모델을 source of truth로 사용한다.
- Pydantic 모델과 JSON schema를 함께 제공한다.
- schema version을 모든 프로젝트 파일에 저장한다.
- serialization 결과가 입력 순서에 따라 달라지지 않도록 한다.
- HOOMD 객체를 프로젝트 모델 내부에 직접 저장하지 않는다.
- Python 코어는 HTML, 브라우저 또는 FastAPI를 import하지 않는다.

### 2.4 2단계 완료 기준

- 예제 프로젝트를 Python 객체와 JSON 사이에서 round trip할 수 있다.
- 잘못된 box, 질량, 직경, timestep을 검출한다.
- 동일 입력으로 항상 동일한 JSON을 생성한다.
- 최소 프로젝트의 HOOMD Python script를 생성한다.
- 모델, 검증기, serializer에 단위 테스트가 있다.

## 3. 정적 HTML 웹 데모

첫 번째 공개 화면은 설치 없이 브라우저에서 확인할 수 있는 정적 데모로 만든다.

### 3.1 기술 범위

- HTML5
- CSS
- JavaScript ES modules
- 초기에는 Node.js와 번들러를 요구하지 않는다.
- 정적 파일 서버와 GitHub Pages에서 실행 가능해야 한다.
- 3D가 반드시 필요한 시점에 고정 버전의 Three.js를 추가한다.
- 첫 화면은 Canvas 또는 SVG 기반의 가벼운 입자 preview로 시작할 수 있다.

### 3.2 첫 화면 구성

```text
+---------------------------------------------------------------+
| Project | Add Particle | Interactions | Preview Code | Export |
+-------------+----------------------------+--------------------+
| Scene Tree  | Simulation View            | Inspector          |
| Box         |                            | Transform          |
| Particles   |                            | Type / Diameter    |
| Layers      |                            | Box / Run Settings |
+-------------+----------------------------+--------------------+
| Potential Preview | Timeline | Validation Messages            |
+---------------------------------------------------------------+
```

### 3.3 최소 상호작용

- particle 선택
- particle 추가와 삭제
- drag를 이용한 위치 변경
- type A/B 변경
- diameter와 color 변경
- 2D/3D box 크기 설정
- LJ 또는 custom `U(r)` 선택
- potential curve preview
- `dt`, `kT`, steps 변경
- 프로젝트 JSON 다운로드
- 생성 예정 HOOMD script preview
- sample trajectory 재생

정적 데모의 Run 버튼은 실제 계산으로 오해되지 않도록 `Play Sample` 또는 `Preview Motion`으로 표시한다.

### 3.4 3단계 완료 기준

- URL을 연 뒤 설치 없이 주요 아이디어를 이해할 수 있다.
- 데스크톱과 태블릿 폭에서 핵심 패널을 사용할 수 있다.
- 키보드로 주요 form control에 접근할 수 있다.
- sample 프로젝트를 불러오고 수정할 수 있다.
- JSON export 결과가 Python 코어 schema와 일치한다.
- 데모 결과가 실제 HOOMD 계산인지 illustrative animation인지 명확히 표시한다.

## 4. 웹과 Python 코어 연결

정적 데모가 안정화된 후 FastAPI를 얇은 adapter로 추가한다.

### 4.1 API 범위

- `GET /api/health`
- `GET /api/schema`
- `POST /api/projects/validate`
- `POST /api/projects/compile`
- `POST /api/interactions/preview`
- `POST /api/runs`
- `GET /api/runs/{run_id}`
- `DELETE /api/runs/{run_id}`
- run progress용 WebSocket 또는 server-sent events

### 4.2 연결 원칙

- API request와 response는 영어 JSON key를 사용한다.
- 오류는 안정적인 code와 영어 message를 제공한다.
- 웹 UI는 HOOMD Python 객체를 알 필요가 없다.
- 실행 요청은 UI/server process와 분리된 worker에서 처리한다.
- Static Demo Mode는 API가 없어도 계속 동작해야 한다.
- API가 연결되면 UI에 `Python Connected` 상태를 명확히 표시한다.

### 4.3 4단계 완료 기준

- 브라우저 프로젝트를 Python validator로 검증할 수 있다.
- Python이 생성한 script를 웹에서 확인할 수 있다.
- API 연결 실패 시 정적 데모로 안전하게 돌아간다.
- long-running simulation이 웹 서버를 차단하지 않는다.

## 5. 실제 HOOMD 실행

Python-connected mode에서 작은 CPU simulation부터 실행한다.

### 5.1 초기 지원 범위

- 구형 입자
- 2D/3D orthorhombic box
- Lennard-Jones pair potential
- constant-volume thermostat
- CPU device
- GSD trajectory
- 기본 thermodynamic log
- run cancel과 checkpoint

### 5.2 실행 안전장치

- particle 수 제한
- 최대 step 수 제한
- maximum wall time
- output 파일 크기 추정
- subprocess isolation
- run별 독립 output directory
- 사용자 Python 코드는 초기 버전에서 실행 금지

### 5.3 5단계 완료 기준

- 웹에서 제출한 작은 프로젝트가 실제 HOOMD run으로 이어진다.
- 진행률, timestep, temperature와 energy가 표시된다.
- 완료된 GSD trajectory를 다시 재생할 수 있다.
- 실패한 run의 원인을 영어 메시지로 확인할 수 있다.

## 6. 커스텀 상호작용

커스텀 상호작용은 내장 potential이 안정화된 후 단계적으로 추가한다.

### 6.1 첫 번째 버전

- 제한된 수식 문법으로 `U(r)` 입력
- 허용 함수와 변수 whitelist
- `F(r) = -dU/dr` 계산
- `r_min`, `r_cut`, resolution 설정
- potential과 force 그래프
- HOOMD table 생성
- two-particle reference test

### 6.2 검증

- `NaN`과 infinity 검출
- singularity 경고
- cutoff 연속성 검사
- 입력 force와 numerical derivative 비교
- 단위 차원 검사
- type pair별 parameter 누락 검사

### 6.3 후속 범위

- CSV table import
- custom bonded interaction
- anisotropic interaction
- Python custom force
- C++/GPU plugin

실행 가능한 custom Python이나 native plugin은 명시적인 사용자 승인 없이 불러오거나 실행하지 않는다.

## 7. 테스트와 품질 관리

### 7.1 Python

- model과 serializer unit test
- validator unit test
- generated code golden test
- two-particle energy/force comparison
- API integration test
- worker cancel과 timeout test

### 7.2 웹

- project store unit test
- JSON import/export test
- 주요 사용자 흐름 browser test
- responsive layout 확인
- keyboard accessibility 확인
- API unavailable 상태 확인

### 7.3 공통 완료 조건

- 새 기능에는 자동화 테스트가 포함된다.
- lint, type check, test가 모두 통과한다.
- 생성 코드와 주석은 모두 영어다.
- 예제 프로젝트가 현재 schema version과 일치한다.
- 주요 과학적 가정이 문서화된다.

## 8. 배포 순서

1. 정적 데모를 GitHub Pages에 배포한다.
2. Python 코어를 로컬 CLI로 먼저 검증한다.
3. FastAPI를 로컬 연결 모드로 제공한다.
4. 제한된 공개 Python backend를 별도 서비스로 검토한다.
5. GPU와 원격 HPC 기능은 로컬 CPU workflow가 안정화된 뒤 추가한다.

공개 backend를 제공할 때는 실행시간, particle 수, storage, rate limit과 임의 코드 실행 위험을 먼저 통제해야 한다.

## 9. 즉시 실행할 작업

다음 작업 세션에서는 **1단계만 구현**한다.

1. Pixi 설치 가능 여부 확인
2. `pixi.toml` 생성
3. HOOMD-blue `7.1.2` CPU 환경 구성
4. `pyproject.toml`과 Python 패키지 골격 생성
5. `.gitignore` 생성
6. `scripts/check_environment.py` 작성
7. 최소 `pytest`, `ruff`, `mypy` 설정
8. 환경 설치 및 import 검증
9. 설치 절차를 `readme.md`에 반영
10. 변경 사항 commit 및 push

1단계가 통과하기 전에는 웹 UI 구현을 시작하지 않는다.
