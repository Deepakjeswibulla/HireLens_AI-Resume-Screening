"""Synthetic demo data.

These are invented profiles. Demo screenings are flagged ``is_demo`` and are
kept separate from anything a recruiter uploads: real uploads always run the
real pipeline, and demo candidates never appear inside a real screening.
"""

from __future__ import annotations

DEMO_JOB_TITLE = "Senior Backend Engineer"
DEMO_COMPANY = "Northwind Labs"

DEMO_JOB_DESCRIPTION = """Senior Backend Engineer - Northwind Labs

About the role
We are a fintech platform processing payments for 4,000+ merchants. You will own
the services that power onboarding, ledgers and reconciliation.

Responsibilities
- Design and build production REST APIs with Python and FastAPI
- Own PostgreSQL schema design, query performance and migrations
- Containerise services with Docker and deploy to AWS
- Partner with product and data teams on new payment flows
- Review code, mentor two junior engineers and raise the engineering bar

Requirements
- 4+ years of professional backend engineering experience
- Strong Python and FastAPI experience in production
- Solid SQL and PostgreSQL knowledge, including query optimisation
- Experience designing REST APIs consumed by web and mobile clients
- Hands-on Docker experience and familiarity with AWS (ECS, S3, RDS)
- Bachelor's degree in Computer Science or a related field

Preferred qualifications
- Kubernetes in production
- Redis for caching and queues
- CI/CD pipelines (GitHub Actions)
- GraphQL experience
- Experience in fintech or payments
"""

_DEMO_RESUMES: list[tuple[str, str]] = [
    (
        "Priya Sharma - Senior Backend Engineer.txt",
        """Priya Sharma
priya.sharma@example.com | +91 98200 11223 | github.com/priyasharma | Bengaluru, India

Professional Summary
Senior backend engineer with 6 years building payment and ledger services in Python.
Deep FastAPI and PostgreSQL experience, comfortable owning a service end to end.

Skills
Python, FastAPI, PostgreSQL, REST API, Docker, AWS, Redis, CI/CD, SQLAlchemy, Testing

Professional Experience
Senior Backend Engineer | Payflow Technologies
Mar 2021 - Present
Designed and shipped FastAPI services handling 2M payments per day. Owned PostgreSQL
schema design, partitioning and query optimisation (p95 latency down 62%). Ran Docker
workloads on AWS ECS with RDS Postgres, Redis caching and GitHub Actions CI/CD.
Mentored two engineers and led API design reviews.

Backend Engineer | Zeta Retail Systems
Jul 2018 - Feb 2021
Built REST APIs in Python and Django for order management. Migrated MySQL reporting
jobs to PostgreSQL and introduced pytest-based test suites.

Education
B.Tech in Computer Science, National Institute of Technology Trichy, 2018

Projects
Ledger reconciliation service
Rebuilt nightly reconciliation as a FastAPI + PostgreSQL service with idempotent writes.

Certifications
AWS Certified Solutions Architect - Associate (2022)
""",
    ),
    (
        "Neha Joshi - Staff Backend Engineer.txt",
        """Neha Joshi
neha.joshi@example.com | +91 99887 65432 | linkedin.com/in/nehajoshi | Pune, India

Summary
Staff engineer with 8 years across payments and marketplace backends. Python, FastAPI,
Kubernetes and AWS at scale.

Technical Skills
Python, FastAPI, PostgreSQL, REST API, Docker, Kubernetes, AWS, Terraform, Redis, CI/CD, GraphQL

Work Experience
Staff Software Engineer | Finlytic
Jan 2020 - Present
Owned the payments core (Python, FastAPI, PostgreSQL). Migrated 40 services to Kubernetes
on AWS EKS with Terraform. Cut infrastructure cost 28%. Introduced GraphQL gateway for
partner integrations and Redis-backed queues for settlement jobs.

Senior Software Engineer | Craft Commerce
Aug 2017 - Dec 2019
Built REST APIs in Python and Flask, PostgreSQL data model for catalogue and pricing.

Education
M.Tech in Computer Science, IIT Bombay, 2017
B.E. in Information Technology, Pune University, 2015

Certifications
CKA - Certified Kubernetes Administrator (2021)
""",
    ),
    (
        "Rahul Verma - Backend Developer.txt",
        """Rahul Verma
rahul.verma@example.com | +91 90000 44556 | Hyderabad, India

Professional Summary
Backend developer with 4 years of experience in Python and Django, focused on
internal platforms and reporting APIs.

Skills
Python, Django, MySQL, REST API, Docker, Git, Linux

Experience
Software Engineer | Trailhead Analytics
Feb 2021 - Present
Developed Django REST APIs for internal reporting. Optimised MySQL queries and added
caching. Packaged services with Docker for staging deployments.

Junior Developer | Webmint Solutions
Jun 2019 - Jan 2021
Maintained Python scripts and a Flask admin portal.

Education
B.E. in Computer Science, Osmania University, 2019

Projects
Inventory sync tool - scheduled Python job syncing stock across two ERPs.
""",
    ),
    (
        "Divya Reddy - Backend Engineer.txt",
        """Divya Reddy
divya.reddy@example.com | +91 91234 56780 | github.com/divyareddy

Summary
Backend engineer with 4 years of experience building Python services and APIs for
logistics products. Comfortable with FastAPI, PostgreSQL and GraphQL.

Skills
Python, FastAPI, PostgreSQL, GraphQL, REST API, Docker, AWS Lambda, Testing, Redis

Experience
Backend Engineer | RouteMile Logistics
Nov 2020 - Present
Built FastAPI services for route planning and pricing, backed by PostgreSQL. Added a
GraphQL layer for the driver app. Deployed on AWS Lambda and ECS with Docker. Wrote
pytest suites covering 82% of the pricing module.

Software Engineer | Novacart
Jul 2019 - Oct 2020
Developed REST APIs in Python and Flask for catalogue search.

Education
B.Tech in Information Technology, VNR Vignana Jyothi, 2019

Projects
Fleet telemetry ingest - FastAPI + Redis pipeline processing 300 events/second.
""",
    ),
    (
        "Karthik Rao - Software Engineer.txt",
        """Karthik Rao
karthik.rao@example.com | +91 98450 12345 | Bengaluru, India

Summary
Software engineer with 3 years of Python backend experience in SaaS startups.

Skills
Python, Flask, Redis, PostgreSQL, Docker, REST API, pytest, CI/CD

Experience
Software Engineer | Quillbyte
Jan 2022 - Present
Built Flask REST APIs and PostgreSQL schemas for a document collaboration product.
Introduced Redis caching and GitHub Actions CI.

Associate Engineer | Quillbyte
Aug 2021 - Dec 2021
Fixed backend bugs and wrote integration tests with pytest.

Education
B.Sc in Computer Science, Christ University, 2021

Projects
Rate limiting middleware - Redis-backed limiter used across all public APIs.
""",
    ),
    (
        "Ananya Iyer - Java Backend Developer.txt",
        """Ananya Iyer
ananya.iyer@example.com | +91 96322 78901 | Chennai, India

Summary
Backend developer with 5 years of Java and Spring Boot experience, currently moving
into Python services.

Skills
Java, Spring Boot, PostgreSQL, REST API, Docker, Kafka, AWS, Python

Experience
Senior Developer | BankServe Technologies
Apr 2020 - Present
Built Spring Boot microservices for loan origination on PostgreSQL, with Kafka event
flows and Docker deployments on AWS. Wrote Python automation scripts for data fixes.

Developer | Hexaware
Jul 2018 - Mar 2020
Maintained Java services and SQL reports for banking clients.

Education
B.Tech in Computer Science, Anna University, 2018
""",
    ),
    (
        "Sneha Gupta - Full Stack Engineer.txt",
        """Sneha Gupta
sneha.gupta@example.com | +91 97111 22334 | Gurugram, India

Summary
Full-stack engineer with 5 years building Node.js and React products.

Skills
JavaScript, TypeScript, Node.js, Express, React, MongoDB, Docker, AWS, REST API

Experience
Senior Full Stack Engineer | Shoply
Mar 2020 - Present
Built Express and TypeScript APIs on MongoDB for a D2C storefront. Deployed with Docker
on AWS ECS. Built React dashboards for merchandisers.

Full Stack Developer | Vibe Digital
Aug 2018 - Feb 2020
Delivered client projects in Node.js and React.

Education
B.Tech in Computer Science, Amity University, 2018
""",
    ),
    (
        "Vikram Singh - DevOps Engineer.txt",
        """Vikram Singh
vikram.singh@example.com | +91 98765 43210 | Noida, India

Summary
DevOps engineer with 7 years running cloud infrastructure and delivery pipelines.

Skills
AWS, Kubernetes, Terraform, Docker, CI/CD, Linux, Bash, Python, Monitoring

Experience
Lead DevOps Engineer | Cloudspire
Feb 2019 - Present
Ran 60+ EKS clusters with Terraform and Helm. Built GitHub Actions pipelines. Wrote Python
tooling for cost reporting and drift detection. Owned Prometheus/Grafana monitoring.

DevOps Engineer | Infosys
Jul 2016 - Jan 2019
Managed AWS infrastructure and Jenkins pipelines for enterprise clients.

Education
B.Tech in Electronics and Communication, Amity University, 2016
""",
    ),
    (
        "Meera Nair - Data Scientist.txt",
        """Meera Nair
meera.nair@example.com | +91 94470 55667 | Kochi, India

Summary
Data scientist with 4 years building machine learning models and Python data services.

Skills
Python, Machine Learning, scikit-learn, PyTorch, Pandas, SQL, Docker, FastAPI, Statistics

Experience
Data Scientist | Insightful Analytics
Jun 2020 - Present
Built churn and pricing models with scikit-learn and PyTorch. Served models through a
FastAPI service in Docker. Owned SQL feature pipelines.

Analyst | Deloitte India
Aug 2018 - May 2020
Built dashboards and SQL reporting for retail clients.

Education
M.Sc in Statistics, Cochin University of Science and Technology, 2018
B.Sc in Mathematics, University of Kerala, 2016
""",
    ),
    (
        "Aditya Menon - Junior Developer.txt",
        """Aditya Menon
aditya.menon@example.com | +91 88990 11224 | Kochi, India

Summary
Final-year computer science graduate looking for a backend role. Built three Python
projects and completed a backend internship.

Skills
Python, FastAPI, SQLite, PostgreSQL, Git, HTML, CSS

Experience
Backend Intern | Sailsys
Jan 2025 - Jun 2025
Wrote FastAPI endpoints for an internal leave-management tool and added pytest tests.

Education
B.Tech in Computer Science, Cochin University of Science and Technology, 2025

Projects
Expense tracker API - FastAPI and PostgreSQL service with JWT auth.
Library manager - Flask CRUD app with SQLite.
""",
    ),
    (
        "Arjun Pillai - PHP Developer.txt",
        """Arjun Pillai
arjun.pillai@example.com | +91 90123 45678 | Thiruvananthapuram, India

Summary
Web developer with 6 years of PHP and Laravel experience delivering client portals.

Skills
PHP, Laravel, MySQL, JavaScript, jQuery, Docker, HTML, CSS

Experience
Senior PHP Developer | Webnest Studio
Mar 2019 - Present
Built Laravel applications and MySQL schemas for 20+ client portals. Added Docker-based
staging environments.

PHP Developer | Cybrox
Jun 2017 - Feb 2019
Maintained WordPress and Laravel sites.

Education
B.Sc in Computer Science, University of Kerala, 2017
""",
    ),
    (
        "Sameer Khan - QA Automation Engineer.txt",
        """Sameer Khan
sameer.khan@example.com | +91 98111 33445 | Delhi, India

Summary
QA automation engineer with 5 years building Python test frameworks for backend APIs.

Skills
Python, pytest, REST API, Docker, CI/CD, Selenium, PostgreSQL, Git

Experience
Senior QA Automation Engineer | Fintech One
Jan 2020 - Present
Built pytest API test suites for payment services, wired into GitHub Actions. Validated
PostgreSQL data migrations and Dockerised test environments.

QA Engineer | GlobalLogic
Aug 2017 - Dec 2019
Automated regression suites with Selenium and Python.

Education
B.Tech in Information Technology, Guru Gobind Singh Indraprastha University, 2017
""",
    ),
]


def demo_resumes() -> list[tuple[str, str]]:
    return list(_DEMO_RESUMES)


DEMO_NOTE = (
    "Synthetic demo screening. Candidate profiles are invented and were processed by the "
    "same matching pipeline as real uploads."
)
