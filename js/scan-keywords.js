/* ATS_Breaker scan: known skills and terms.
   Each entry: "Canonical|alias|alias". A leading "!" marks a certification.
   Keywords the job description lists that aren't here are still picked up
   from its Required/Preferred lists (see scan-score.js). Add terms freely. */
(function () {
  "use strict";
  var ATS = window.ATS = window.ATS || {};

  var TERMS = [
    // Cloud, infrastructure, DevOps, SRE
    "AWS|Amazon Web Services", "Azure|Microsoft Azure", "Google Cloud|GCP|Google Cloud Platform",
    "Kubernetes|K8s", "Docker|containers|containerisation|containerization", "Terraform", "Ansible", "Puppet", "Chef",
    "Helm", "OpenShift", "EKS", "GKE", "AKS", "ECS", "EC2", "S3", "Lambda", "CloudFormation", "Pulumi",
    "CI/CD|CI CD|continuous integration|continuous delivery|continuous deployment",
    "GitLab CI|GitLab CI/CD", "GitHub Actions", "Jenkins", "CircleCI", "Travis CI", "Azure DevOps|Azure Pipelines", "Argo CD|ArgoCD",
    "Prometheus", "Grafana", "Datadog", "New Relic", "Splunk", "ELK|Elastic Stack|ELK Stack", "Elasticsearch", "Kibana",
    "OpenTelemetry", "PagerDuty", "observability", "monitoring", "alerting",
    "incident response|incident management", "on-call|on call", "SLOs|SLO|service level objectives",
    "SLAs|SLA|service level agreements", "SLIs|SLI", "error budgets|error budget", "postmortems|post-mortems|postmortem",
    "infrastructure as code|IaC", "site reliability engineering|SRE", "DevOps", "Linux", "Unix", "Bash|shell scripting",
    "PowerShell", "networking", "TCP/IP", "DNS", "load balancing", "Nginx", "Apache", "Kafka|Apache Kafka", "RabbitMQ",
    "Redis", "Vault|HashiCorp Vault", "Consul", "Istio", "service mesh", "serverless", "microservices", "distributed systems",
    "high availability", "disaster recovery", "capacity planning", "performance tuning", "cost optimisation|cost optimization",

    // Programming languages and frameworks
    "Python", "Go|Golang", "Java", "JavaScript|JS", "TypeScript|TS", "C++", "C#", "Ruby", "PHP", "Rust", "Scala", "Kotlin",
    "Swift", "Objective-C", "R", "MATLAB", "Perl", "Elixir", "Haskell", "Dart", "Lua", "Groovy", "Solidity",
    "SQL", "NoSQL", "PostgreSQL|Postgres", "MySQL", "SQL Server|MSSQL", "Oracle", "MongoDB", "DynamoDB", "Cassandra",
    "SQLite", "Snowflake", "BigQuery", "Redshift", "Databricks",
    "React|React.js|ReactJS", "Angular", "Vue|Vue.js", "Svelte", "Next.js", "Node.js|Node|NodeJS", "Express", "Django",
    "Flask", "FastAPI", "Spring|Spring Boot", "Rails|Ruby on Rails", "Laravel", ".NET|dotnet", "ASP.NET", "jQuery",
    "HTML", "CSS", "Sass|SCSS", "Tailwind|Tailwind CSS", "GraphQL", "REST|RESTful|REST APIs", "gRPC", "WebSockets",
    "React Native", "Flutter", "iOS", "Android", "SwiftUI", "Jetpack Compose",
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence",
    "unit testing", "test automation", "TDD|test-driven development", "Selenium", "Cypress", "Playwright", "Jest", "pytest",
    "JUnit", "QA|quality assurance", "API design", "system design", "object-oriented programming|OOP", "data structures",
    "algorithms", "accessibility|WCAG", "web performance", "security", "OAuth", "authentication", "encryption",
    "penetration testing|pen testing", "SIEM", "vulnerability management", "threat modelling|threat modeling",
    "identity and access management|IAM", "ISO 27001", "SOC 2", "GDPR", "HIPAA", "PCI DSS",

    // Data, ML, analytics
    "machine learning|ML", "deep learning", "AI|artificial intelligence", "NLP|natural language processing",
    "computer vision", "LLMs|LLM|large language models", "generative AI", "PyTorch", "TensorFlow", "scikit-learn|sklearn",
    "Keras", "pandas", "NumPy", "Spark|Apache Spark|PySpark", "Hadoop", "Airflow|Apache Airflow", "dbt", "ETL|ELT",
    "data pipelines|data pipeline", "data modelling|data modeling", "data warehousing|data warehouse", "data analysis",
    "data visualisation|data visualization", "statistics", "A/B testing|AB testing|experimentation", "Excel|Microsoft Excel",
    "Tableau", "Power BI|PowerBI", "Looker", "Google Analytics|GA4", "Mixpanel", "Amplitude", "SAS", "SPSS", "forecasting",

    // Design and product
    "Figma", "Sketch", "Adobe XD", "Adobe Creative Suite|Adobe Creative Cloud", "Photoshop", "Illustrator", "InDesign",
    "After Effects", "Premiere Pro", "UX|user experience", "UI|user interface", "UX research|user research",
    "usability testing", "wireframing|wireframes", "prototyping", "design systems|design system", "interaction design",
    "visual design", "information architecture", "product management", "product strategy", "roadmapping|roadmaps",
    "user stories", "requirements gathering", "Agile", "Scrum", "Kanban", "Lean", "waterfall",

    // Business, marketing, sales, operations
    "project management", "programme management|program management", "stakeholder management", "change management",
    "risk management", "budgeting", "financial modelling|financial modeling", "forecasting", "P&L|profit and loss",
    "accounting", "bookkeeping", "payroll", "audit|auditing", "tax", "IFRS", "GAAP", "Xero", "QuickBooks", "SAP", "Salesforce",
    "HubSpot", "CRM", "ERP", "SEO|search engine optimisation|search engine optimization", "SEM", "PPC", "Google Ads",
    "content marketing", "email marketing", "social media", "copywriting", "content strategy", "brand strategy",
    "marketing automation", "lead generation", "account management", "business development", "B2B", "B2C", "SaaS",
    "negotiation", "customer success", "customer service", "recruitment|recruiting", "talent acquisition", "onboarding",
    "employee relations", "supply chain", "logistics", "procurement", "inventory management", "operations management",
    "process improvement", "Six Sigma", "Lean Six Sigma", "quality management", "compliance", "contract management",
    "public speaking", "presentations", "technical writing", "documentation", "mentoring", "coaching", "team leadership",
    "people management", "cross-functional collaboration",

    // Healthcare and education (common terms)
    "patient care", "clinical", "EHR|electronic health records", "EMR", "triage", "phlebotomy", "CPR", "BLS",
    "curriculum development", "lesson planning", "classroom management", "safeguarding",

    // Certifications
    "!AWS Certified Solutions Architect|AWS Solutions Architect|AWS Solutions Architect – Associate|AWS Solutions Architect - Associate",
    "!AWS Certified Developer", "!AWS Certified SysOps Administrator", "!CKA|Certified Kubernetes Administrator",
    "!CKAD|Certified Kubernetes Application Developer", "!Terraform Associate|HashiCorp Certified Terraform Associate",
    "!Azure Administrator|AZ-104", "!Azure Solutions Architect|AZ-305", "!Google Cloud Professional|Professional Cloud Architect",
    "!PMP|Project Management Professional", "!PRINCE2", "!CSM|Certified ScrumMaster|Certified Scrum Master", "!PSM|Professional Scrum Master",
    "!ITIL", "!CISSP", "!CISM", "!CEH|Certified Ethical Hacker", "!Security+|CompTIA Security+", "!Network+|CompTIA Network+",
    "!CCNA", "!CPA", "!ACCA", "!CIMA", "!CFA", "!CIPD", "!SHRM-CP", "!Six Sigma Green Belt", "!Six Sigma Black Belt"
  ];

  // Terms that count as "related" evidence for another keyword (shown as Partial).
  var RELATED = {
    "CI/CD": ["GitLab CI", "GitHub Actions", "Jenkins", "CircleCI", "Travis CI", "Azure DevOps", "Argo CD"],
    "Kubernetes": ["EKS", "GKE", "AKS", "OpenShift"],
    "AWS": ["EC2", "S3", "Lambda", "CloudFormation", "ECS", "EKS", "DynamoDB", "Redshift"],
    "Azure": ["AKS", "Azure DevOps"],
    "Google Cloud": ["GKE", "BigQuery"],
    "SQL": ["PostgreSQL", "MySQL", "SQL Server", "Oracle", "SQLite", "BigQuery", "Snowflake", "Redshift"],
    "Agile": ["Scrum", "Kanban"],
    "monitoring": ["Prometheus", "Grafana", "Datadog", "New Relic", "Splunk"],
    "observability": ["Prometheus", "Grafana", "Datadog", "OpenTelemetry", "New Relic"],
    "incident response": ["on-call", "postmortems", "PagerDuty"],
    "machine learning": ["PyTorch", "TensorFlow", "scikit-learn", "deep learning"],
    "data visualisation": ["Tableau", "Power BI", "Looker"],
    "JavaScript": ["TypeScript", "React", "Node.js", "Vue", "Angular"],
    "CRM": ["Salesforce", "HubSpot"],
    "infrastructure as code": ["Terraform", "CloudFormation", "Pulumi", "Ansible"],
    "containers": ["Docker", "Kubernetes"]
  };

  // Short or ambiguous words that only count with exact capitalisation.
  var CASE_SENSITIVE = { "Go": 1, "R": 1, "IAM": 1, "UI": 1, "UX": 1, "QA": 1, "ML": 1, "AI": 1, "JS": 1, "TS": 1, "SRE": 1, "Lean": 1, "Spark": 1, "Node": 1, "Express": 1, "Apache": 1, "Oracle": 1, "Chef": 1, "Puppet": 1, "Swift": 1, "Rust": 1, "Dart": 1, "Spring": 1, "Rails": 1, "Lambda": 1, "Vault": 1, "Consul": 1, "Helm": 1, "SAS": 1, "Go|Golang": 1 };

  ATS.terms = TERMS.map(function (line) {
    var cert = line.charAt(0) === "!";
    var names = (cert ? line.slice(1) : line).split("|");
    return { term: names[0], aliases: names.slice(1), cert: cert };
  });
  ATS.related = RELATED;
  ATS.caseSensitive = CASE_SENSITIVE;
})();
