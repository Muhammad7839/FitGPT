# Branch Validation Checklist

This checklist captures the reproducible verification commands used to harden the `backend-features` branch on 2026-04-12.

## Commands

### Android unit tests
```bash
./gradlew test
```

### Web unit tests
```bash
cd web
npm run test:ci
```

### Backend integration tests
```bash
cd backend
./.venv/bin/pytest
```

## Latest Result Snapshot

- Android unit tests: passed
- Web unit tests: passed
- Backend integration tests: passed

## Warning Status

- Android unit-test build: no active compiler warnings in the validated run.
- Web unit tests: no active warnings in the validated run.
- Backend integration tests: no active warning summary in the validated run.

## Follow-up Use

- Use this checklist before merging branch cleanups so validation runs stay consistent across Android, web, and backend surfaces.
