"""Skill taxonomy: canonical skills, aliases and related-skill relations.

This is deliberately a hand-maintained dictionary rather than a scraped
ontology: it is small enough to audit, and every relation in it is defensible
in a review. `related` expresses *partial* overlap only - it never makes two
skills equivalent (Java is not JavaScript, React is not Angular).
"""

from __future__ import annotations

# canonical -> {"aliases": [...], "related": [...], "category": str}
SKILL_TAXONOMY: dict[str, dict] = {
    # ---- languages -------------------------------------------------------
    "Python": {"aliases": ["python", "python3", "py"], "related": [], "category": "language"},
    "JavaScript": {"aliases": ["javascript", "js", "es6", "ecmascript"], "related": ["TypeScript"], "category": "language"},
    "TypeScript": {"aliases": ["typescript", "ts"], "related": ["JavaScript"], "category": "language"},
    "Java": {"aliases": ["java", "java 8", "java8", "java 11", "java 17"], "related": ["Kotlin", "Spring Boot"], "category": "language"},
    "C#": {"aliases": ["c#", "csharp", "c sharp"], "related": [".NET"], "category": "language"},
    "C++": {"aliases": ["c++", "cpp"], "related": ["C"], "category": "language"},
    "C": {"aliases": ["c language", "ansi c"], "related": ["C++"], "category": "language"},
    "Go": {"aliases": ["golang", "go lang"], "related": [], "category": "language"},
    "Rust": {"aliases": ["rust"], "related": [], "category": "language"},
    "Ruby": {"aliases": ["ruby"], "related": ["Ruby on Rails"], "category": "language"},
    "PHP": {"aliases": ["php"], "related": ["Laravel"], "category": "language"},
    "Kotlin": {"aliases": ["kotlin"], "related": ["Java", "Android"], "category": "language"},
    "Swift": {"aliases": ["swift"], "related": ["iOS"], "category": "language"},
    "Scala": {"aliases": ["scala"], "related": ["Java", "Apache Spark"], "category": "language"},
    "R": {"aliases": ["r language", "r programming"], "related": ["Statistics"], "category": "language"},
    "SQL": {"aliases": ["sql", "ansi sql", "t-sql", "pl/sql"], "related": ["PostgreSQL", "MySQL"], "category": "language"},
    "Bash": {"aliases": ["bash", "shell scripting", "shell script", "zsh"], "related": ["Linux"], "category": "language"},

    # ---- frontend --------------------------------------------------------
    "React": {"aliases": ["react", "react.js", "reactjs"], "related": ["React Native", "Next.js"], "category": "frontend"},
    "React Native": {"aliases": ["react native"], "related": ["React", "Android", "iOS"], "category": "frontend"},
    "Next.js": {"aliases": ["next.js", "nextjs"], "related": ["React"], "category": "frontend"},
    "Angular": {"aliases": ["angular", "angularjs", "angular 2+"], "related": ["TypeScript"], "category": "frontend"},
    "Vue.js": {"aliases": ["vue", "vue.js", "vuejs"], "related": ["JavaScript"], "category": "frontend"},
    "Svelte": {"aliases": ["svelte", "sveltekit"], "related": ["JavaScript"], "category": "frontend"},
    "Redux": {"aliases": ["redux", "redux toolkit", "rtk"], "related": ["React"], "category": "frontend"},
    "HTML": {"aliases": ["html", "html5"], "related": ["CSS"], "category": "frontend"},
    "CSS": {"aliases": ["css", "css3", "scss", "sass", "less"], "related": ["HTML", "Tailwind CSS"], "category": "frontend"},
    "Tailwind CSS": {"aliases": ["tailwind", "tailwindcss", "tailwind css"], "related": ["CSS"], "category": "frontend"},
    "Webpack": {"aliases": ["webpack", "vite", "rollup", "esbuild"], "related": ["JavaScript"], "category": "frontend"},
    "Accessibility": {"aliases": ["accessibility", "a11y", "wcag"], "related": ["HTML"], "category": "frontend"},

    # ---- backend ---------------------------------------------------------
    "FastAPI": {"aliases": ["fastapi", "fast api"], "related": ["Python", "REST API"], "category": "backend"},
    "Django": {"aliases": ["django"], "related": ["Python"], "category": "backend"},
    "Flask": {"aliases": ["flask"], "related": ["Python"], "category": "backend"},
    "Node.js": {"aliases": ["node", "node.js", "nodejs"], "related": ["JavaScript", "Express"], "category": "backend"},
    "Express": {"aliases": ["express", "express.js", "expressjs"], "related": ["Node.js"], "category": "backend"},
    "Spring Boot": {"aliases": ["spring boot", "spring", "springboot"], "related": ["Java"], "category": "backend"},
    ".NET": {"aliases": [".net", "dotnet", "asp.net", "asp.net core"], "related": ["C#"], "category": "backend"},
    "Ruby on Rails": {"aliases": ["rails", "ruby on rails"], "related": ["Ruby"], "category": "backend"},
    "Laravel": {"aliases": ["laravel"], "related": ["PHP"], "category": "backend"},
    "REST API": {"aliases": ["rest", "rest api", "restful", "restful api", "rest apis", "restful services"], "related": ["GraphQL", "FastAPI"], "category": "backend"},
    "GraphQL": {"aliases": ["graphql", "apollo graphql"], "related": ["REST API"], "category": "backend"},
    "gRPC": {"aliases": ["grpc", "protobuf", "protocol buffers"], "related": ["REST API"], "category": "backend"},
    "Microservices": {"aliases": ["microservices", "microservice architecture", "service oriented architecture"], "related": ["Docker", "Kubernetes"], "category": "backend"},
    "WebSockets": {"aliases": ["websocket", "websockets", "socket.io"], "related": ["REST API"], "category": "backend"},

    # ---- data / databases ------------------------------------------------
    "PostgreSQL": {"aliases": ["postgres", "postgresql", "psql"], "related": ["SQL"], "category": "database"},
    "MySQL": {"aliases": ["mysql", "mariadb"], "related": ["SQL"], "category": "database"},
    "SQLite": {"aliases": ["sqlite", "sqlite3"], "related": ["SQL"], "category": "database"},
    "MongoDB": {"aliases": ["mongodb", "mongo"], "related": ["NoSQL"], "category": "database"},
    "Redis": {"aliases": ["redis", "memcached"], "related": ["Caching"], "category": "database"},
    "Elasticsearch": {"aliases": ["elasticsearch", "elastic search", "opensearch"], "related": ["Search"], "category": "database"},
    "NoSQL": {"aliases": ["nosql", "dynamodb", "cassandra", "firestore"], "related": ["MongoDB"], "category": "database"},
    "SQLAlchemy": {"aliases": ["sqlalchemy", "alembic", "orm"], "related": ["Python", "SQL"], "category": "database"},
    "Data Modeling": {"aliases": ["data modeling", "data modelling", "schema design", "database design"], "related": ["SQL"], "category": "database"},
    "ETL": {"aliases": ["etl", "elt", "data pipeline", "data pipelines", "airflow", "dbt"], "related": ["Apache Spark", "Data Warehousing"], "category": "data"},
    "Data Warehousing": {"aliases": ["data warehouse", "data warehousing", "snowflake", "bigquery", "redshift"], "related": ["ETL"], "category": "data"},
    "Apache Spark": {"aliases": ["spark", "apache spark", "pyspark"], "related": ["ETL", "Scala"], "category": "data"},
    "Kafka": {"aliases": ["kafka", "apache kafka", "event streaming"], "related": ["Microservices"], "category": "data"},
    "Pandas": {"aliases": ["pandas", "numpy", "polars"], "related": ["Python", "Data Analysis"], "category": "data"},
    "Data Analysis": {"aliases": ["data analysis", "data analytics", "exploratory data analysis", "eda"], "related": ["Pandas", "Statistics"], "category": "data"},
    "Statistics": {"aliases": ["statistics", "statistical analysis", "statistical modeling", "hypothesis testing"], "related": ["Machine Learning"], "category": "data"},
    "Data Visualization": {"aliases": ["data visualization", "data visualisation", "tableau", "power bi", "looker", "matplotlib", "plotly"], "related": ["Data Analysis"], "category": "data"},

    # ---- ML / AI ---------------------------------------------------------
    "Machine Learning": {"aliases": ["machine learning", "ml", "supervised learning", "predictive modeling", "predictive modelling"], "related": ["Deep Learning", "scikit-learn"], "category": "ml"},
    "Deep Learning": {"aliases": ["deep learning", "neural networks", "neural network", "cnn", "rnn", "lstm", "transformer models"], "related": ["Machine Learning", "PyTorch", "TensorFlow"], "category": "ml"},
    "Natural Language Processing": {"aliases": ["nlp", "natural language processing", "text mining", "computational linguistics"], "related": ["Machine Learning", "LLM Engineering"], "category": "ml"},
    "Computer Vision": {"aliases": ["computer vision", "image classification", "object detection", "opencv"], "related": ["Deep Learning"], "category": "ml"},
    "PyTorch": {"aliases": ["pytorch", "torch"], "related": ["Deep Learning", "TensorFlow"], "category": "ml"},
    "TensorFlow": {"aliases": ["tensorflow", "keras"], "related": ["Deep Learning", "PyTorch"], "category": "ml"},
    "scikit-learn": {"aliases": ["scikit-learn", "sklearn", "scikit learn"], "related": ["Machine Learning"], "category": "ml"},
    "Hugging Face": {"aliases": ["hugging face", "huggingface", "transformers library"], "related": ["Natural Language Processing"], "category": "ml"},
    "Sentence Transformers": {"aliases": ["sentence transformers", "sentence-transformers", "embeddings", "vector embeddings", "semantic search"], "related": ["Natural Language Processing", "Vector Databases"], "category": "ml"},
    "LLM Engineering": {"aliases": ["llm", "large language model", "large language models", "prompt engineering", "rag", "retrieval augmented generation", "openai api", "gpt"], "related": ["Natural Language Processing", "Hugging Face"], "category": "ml"},
    "Recommendation Systems": {"aliases": ["recommendation system", "recommendation systems", "recommender systems", "ranking systems"], "related": ["Machine Learning"], "category": "ml"},
    "MLOps": {"aliases": ["mlops", "model deployment", "model serving", "ml pipeline", "feature store"], "related": ["Docker", "Machine Learning"], "category": "ml"},
    "Vector Databases": {"aliases": ["vector database", "vector db", "pinecone", "faiss", "weaviate", "chroma"], "related": ["Sentence Transformers"], "category": "ml"},
    "A/B Testing": {"aliases": ["a/b testing", "ab testing", "experimentation", "experiment design"], "related": ["Statistics"], "category": "data"},

    # ---- cloud / devops --------------------------------------------------
    "AWS": {"aliases": ["aws", "amazon web services", "ec2", "s3", "lambda", "eks", "ecs"], "related": ["Cloud"], "category": "cloud"},
    "Azure": {"aliases": ["azure", "microsoft azure"], "related": ["Cloud"], "category": "cloud"},
    "GCP": {"aliases": ["gcp", "google cloud", "google cloud platform"], "related": ["Cloud"], "category": "cloud"},
    "Cloud": {"aliases": ["cloud computing", "cloud infrastructure"], "related": ["AWS"], "category": "cloud"},
    "Docker": {"aliases": ["docker", "containerization", "containers"], "related": ["Kubernetes"], "category": "devops"},
    "Kubernetes": {"aliases": ["kubernetes", "k8s", "helm"], "related": ["Docker"], "category": "devops"},
    "CI/CD": {"aliases": ["ci/cd", "cicd", "continuous integration", "continuous deployment", "continuous delivery", "jenkins", "github actions", "gitlab ci"], "related": ["DevOps"], "category": "devops"},
    "Terraform": {"aliases": ["terraform", "infrastructure as code", "iac", "pulumi"], "related": ["AWS", "DevOps"], "category": "devops"},
    "DevOps": {"aliases": ["devops", "sre", "site reliability", "platform engineering"], "related": ["CI/CD"], "category": "devops"},
    "Linux": {"aliases": ["linux", "unix", "ubuntu", "centos"], "related": ["Bash"], "category": "devops"},
    "Monitoring": {"aliases": ["monitoring", "observability", "prometheus", "grafana", "datadog", "logging"], "related": ["DevOps"], "category": "devops"},
    "Git": {"aliases": ["git", "github", "gitlab", "bitbucket", "version control"], "related": [], "category": "devops"},
    "Caching": {"aliases": ["caching", "cache", "cdn"], "related": ["Redis"], "category": "devops"},
    "Search": {"aliases": ["search relevance", "full text search", "information retrieval"], "related": ["Elasticsearch"], "category": "data"},

    # ---- mobile / platform ----------------------------------------------
    "Android": {"aliases": ["android", "android sdk", "jetpack compose"], "related": ["Kotlin"], "category": "mobile"},
    "iOS": {"aliases": ["ios", "swiftui", "uikit"], "related": ["Swift"], "category": "mobile"},
    "Flutter": {"aliases": ["flutter", "dart"], "related": ["React Native"], "category": "mobile"},

    # ---- product / process ----------------------------------------------
    "Agile": {"aliases": ["agile", "scrum", "kanban", "sprint planning"], "related": ["Product Management"], "category": "process"},
    "Product Management": {"aliases": ["product management", "product owner", "roadmap", "product strategy"], "related": ["Agile"], "category": "process"},
    "System Design": {"aliases": ["system design", "distributed systems", "scalability", "high availability", "architecture design"], "related": ["Microservices"], "category": "process"},
    "Code Review": {"aliases": ["code review", "code reviews", "pair programming"], "related": ["Git"], "category": "process"},
    "Mentoring": {"aliases": ["mentoring", "mentorship", "coaching", "team leadership", "tech lead"], "related": [], "category": "process"},
    "Stakeholder Management": {"aliases": ["stakeholder management", "cross-functional collaboration", "cross functional"], "related": ["Agile"], "category": "process"},
    "Technical Writing": {"aliases": ["technical writing", "documentation"], "related": [], "category": "process"},
    "Testing": {"aliases": ["unit testing", "integration testing", "test automation", "pytest", "jest", "vitest", "cypress", "playwright", "selenium", "tdd"], "related": ["CI/CD"], "category": "process"},
    "Security": {"aliases": ["application security", "appsec", "owasp", "penetration testing", "security best practices", "oauth", "authentication", "authorization"], "related": ["DevOps"], "category": "process"},

    # ---- design ----------------------------------------------------------
    "UI/UX Design": {"aliases": ["ui/ux", "ux design", "ui design", "user experience", "figma", "design systems"], "related": ["Accessibility"], "category": "design"},
    "Framer Motion": {"aliases": ["framer motion", "framer-motion"], "related": ["React"], "category": "frontend"},
    "Recharts": {"aliases": ["recharts", "chart.js", "d3.js", "d3"], "related": ["Data Visualization"], "category": "frontend"},
}


def _build_alias_index() -> dict[str, str]:
    index: dict[str, str] = {}
    for canonical, meta in SKILL_TAXONOMY.items():
        index[canonical.lower()] = canonical
        for alias in meta["aliases"]:
            index.setdefault(alias.lower(), canonical)
    return index


ALIAS_INDEX: dict[str, str] = _build_alias_index()

# Aliases sorted longest-first so that "react native" wins over "react" and
# "javascript" wins over "java" when both could match the same span.
SORTED_ALIASES: list[tuple[str, str]] = sorted(
    ALIAS_INDEX.items(), key=lambda item: len(item[0]), reverse=True
)

RELATED_MAP: dict[str, set[str]] = {
    canonical: {r for r in meta.get("related", []) if r in SKILL_TAXONOMY}
    for canonical, meta in SKILL_TAXONOMY.items()
}


def canonical_name(text: str) -> str | None:
    """Return the canonical skill for an alias/name, if known."""
    return ALIAS_INDEX.get((text or "").strip().lower())


def related_skills(skill: str) -> set[str]:
    canonical = canonical_name(skill) or skill
    out = set(RELATED_MAP.get(canonical, set()))
    # relation is symmetric for matching purposes
    for other, rel in RELATED_MAP.items():
        if canonical in rel:
            out.add(other)
    out.discard(canonical)
    return out


def category_of(skill: str) -> str:
    canonical = canonical_name(skill) or skill
    return SKILL_TAXONOMY.get(canonical, {}).get("category", "other")


def all_canonical_skills() -> list[str]:
    return sorted(SKILL_TAXONOMY)
