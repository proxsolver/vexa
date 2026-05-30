# Backlog: Per-Account Groq API Key Management

## Priority: Medium
## Status: Backlog
## Created: 2026-05-23

## Summary

Allow each user account to configure their own Groq API key for AI Summary generation, with encrypted storage and retrieval.

## Background

Currently, AI Summary uses a single global `GROQ_API_KEY` environment variable shared across all users. This has several problems:
- All users share the same API quota
- No per-user cost tracking
- One user's heavy usage impacts all others
- No way to enforce per-user rate limits

## Requirements

### User-Facing
1. **API Key Input**: Profile page에 Groq API Key 입력 필드 추가
2. **Validation**: 입력 시 키 유효성 검증 (test API call)
3. **Masked Display**: 저장 후 마스킹된 키 표시 (`gsk_a7Kb...wtYn`)
4. **Delete**: 키 삭제 기능
5. **Status**: AI Summary 활성화/비활성화 상태 표시

### Backend
1. **Encrypted Storage**: AES-256-GCM 암호화로 DB 저장
2. **Encryption Key**: `ENCRYPTION_MASTER_KEY` 환경변수 사용
3. **API Endpoints**:
   - `PUT /user/llm-config` - API 키 저장/업데이트
   - `GET /user/llm-config` - 마스킹된 설정 조회
   - `DELETE /user/llm-config` - 키 삭제
4. **Fallback**: 사용자 키 없으면 글로벌 키 사용 (선택적)

### Security
- API 키는 절대 평문으로 저장하지 않음
- 로그에 API 키 노출 금지
- 키 검증 시 최소 토큰 사용 (짧은 프롬프트)

## Technical Design

### DB Schema
```sql
ALTER TABLE users ADD COLUMN llm_config JSONB DEFAULT '{}';
-- 내부 구조: { "encrypted_key": "...", "key_preview": "gsk_a7Kb...", "provider": "groq", "model": "llama-3.3-70b-versatile" }
```

### Encryption Module
```
services/meeting-api/meeting_api/crypto.py
- encrypt_api_key(plain_key: str) -> str
- decrypt_api_key(encrypted: str) -> str
```

### Flow
1. User inputs Groq API key in Profile page
2. Dashboard calls `PUT /api/vexa/user/llm-config`
3. API gateway proxies to meeting-api
4. Meeting-api validates key (short Groq API call)
5. Encrypts with AES-256-GCM
6. Stores in `users.llm_config`
7. On AI Summary generation, decrypt user's key
8. Falls back to global `GROQ_API_KEY` if user key not set

## Acceptance Criteria
- [ ] 사용자가 Profile에서 Groq API 키 입력/저장 가능
- [ ] 키가 암호화되어 DB에 저장됨
- [ ] 저장된 키로 AI Summary 정상 생성
- [ ] 마스킹된 키 표시
- [ ] 키 삭제 후 글로벌 키로 폴백
- [ ] 로그에 키 노출 없음
