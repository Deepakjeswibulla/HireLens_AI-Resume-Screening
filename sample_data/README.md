# Sample data

All resumes here are **synthetic** — invented people, employers and dates — generated for testing
and demonstration. They contain no real personal data.

- `job_description.txt` — a Senior Backend Engineer JD that pairs with the resumes below.
- `*.pdf`, `*.docx` — ten resumes (5 PDF, 5 DOCX) with deliberately varied profiles: strong
  backend matches, a PHP developer, a DevOps engineer, a QA engineer, a data scientist profile and
  a fresh graduate with an internship.
- `broken_resume.pdf` — a deliberately corrupt file. Upload it with the others to see how HireLens
  records a per-file failure without aborting the batch.

Quick check with the API:

```bash
cd backend && uvicorn app.main:app --port 8000
# then in the UI: New Screening → paste job_description.txt → upload all files → Analyse
```
