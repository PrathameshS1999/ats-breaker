/* ATS_Breaker scan: known skills, tools and certifications.
   Each entry: "Canonical|alias|alias". A leading "!" marks a certification.
   Keywords the job description lists that aren't here are still picked up
   from its Required/Preferred lists (see scan-score.js). Add terms freely.
   Rules applied in scan-score.js:
   - Short all-caps acronyms (SEO, CRM, IAM…) only match in capitals.
   - Words in CASE_SENSITIVE only match with that exact capitalisation.
   - Words in AMBIGUOUS also need context on the same line (a list, or nearby
     words of the right kind), so "Go to market" or "Lean in" don't count. */
(function () {
  "use strict";
  var ATS = window.ATS = window.ATS || {};

  var TERMS = [
    /* ---------- Programming languages ---------- */
    "Python", "Go|Golang", "Java", "JavaScript|JS|ECMAScript", "TypeScript|TS", "C++|CPP", "C#|C Sharp", "C",
    "Ruby", "PHP", "Rust", "Scala", "Kotlin", "Swift", "Objective-C", "R", "MATLAB", "Perl", "Elixir", "Erlang",
    "Haskell", "Clojure", "F#", "OCaml", "Dart", "Lua", "Groovy", "Julia", "Fortran", "COBOL", "assembly language",
    "VBA", "Visual Basic|VB.NET", "Bash|shell scripting|shell scripts", "PowerShell", "Solidity", "WebAssembly|Wasm",
    "SQL", "PL/SQL", "T-SQL|TSQL", "NoSQL", "GraphQL", "HTML|HTML5", "CSS|CSS3", "Sass|SCSS", "XML", "JSON", "YAML",

    /* ---------- Web, mobile and application frameworks ---------- */
    "React|React.js|ReactJS", "Angular|AngularJS", "Vue|Vue.js|VueJS", "Svelte|SvelteKit", "Next.js|NextJS",
    "Nuxt|Nuxt.js", "Gatsby", "Ember.js|Ember", "Backbone.js", "jQuery", "Redux", "MobX", "RxJS", "Tailwind|Tailwind CSS",
    "Bootstrap", "Material UI|MUI", "Storybook", "Webpack", "Vite", "Babel", "ESLint",
    "Node.js|Node|NodeJS", "Express|Express.js", "NestJS", "Deno", "Django", "Flask", "FastAPI", "Celery", "SQLAlchemy",
    "Spring|Spring Boot", "Hibernate", "Maven", "Gradle", "Quarkus", "Rails|Ruby on Rails", "Laravel", "Symfony",
    "CodeIgniter", "WordPress", "Drupal", "Magento|Adobe Commerce", "Shopify", "Webflow", "Contentful",
    ".NET|dotnet|.NET Core", "ASP.NET", "Entity Framework", "Blazor", "Xamarin", "Unity", "Unreal Engine", "Godot",
    "Electron", "React Native", "Flutter", "Ionic", "SwiftUI", "UIKit", "Jetpack Compose", "iOS", "Android", "Xcode",
    "Android Studio", "Qt", "gRPC", "Protocol Buffers|protobuf", "REST|RESTful|REST APIs|REST API", "SOAP",
    "OpenAPI|Swagger", "WebSockets", "OAuth|OAuth2|OAuth 2.0", "JWT", "SAML", "OpenID Connect|OIDC", "LDAP",
    "Active Directory", "microservices", "distributed systems", "event-driven architecture", "serverless",
    "API design", "system design", "object-oriented programming|OOP", "functional programming", "design patterns",
    "data structures", "algorithms", "web performance", "progressive web apps|PWA", "single-page applications|SPA",
    "server-side rendering|SSR", "responsive design", "cross-browser compatibility",

    /* ---------- Testing and quality ---------- */
    "unit testing|unit tests", "integration testing|integration tests", "end-to-end testing|E2E testing|E2E tests",
    "TDD|test-driven development", "BDD|behaviour-driven development|behavior-driven development",
    "Selenium", "Cypress", "Playwright", "Puppeteer", "Jest", "Mocha", "Jasmine", "Vitest", "pytest", "JUnit", "TestNG",
    "Mockito", "RSpec", "Cucumber", "Postman", "JMeter", "Gatling", "LoadRunner", "Appium",
    "test automation|automated testing", "manual testing", "regression testing", "performance testing|load testing",
    "QA|quality assurance", "SonarQube", "code review|code reviews", "test planning|test plans", "UAT|user acceptance testing",

    /* ---------- Developer tools and collaboration ---------- */
    "Git", "GitHub", "GitLab", "Bitbucket", "SVN|Subversion", "Jira", "Confluence", "Trello", "Asana", "Monday.com",
    "Notion", "ClickUp", "Slack", "Microsoft Teams|MS Teams", "Visual Studio", "VS Code|Visual Studio Code", "IntelliJ",

    /* ---------- Cloud, infrastructure, DevOps, SRE ---------- */
    "AWS|Amazon Web Services", "Azure|Microsoft Azure", "Google Cloud|GCP|Google Cloud Platform",
    "EC2", "S3", "Lambda|AWS Lambda", "ECS", "EKS", "Fargate", "RDS", "Aurora", "DynamoDB", "CloudFormation",
    "CloudWatch", "IAM|identity and access management", "VPC", "Route 53", "SQS", "SNS", "Kinesis", "Step Functions",
    "API Gateway", "CloudFront", "Elastic Beanstalk", "SageMaker", "Redshift", "Athena", "AWS Glue", "EMR",
    "Azure Functions", "Azure DevOps|Azure Pipelines", "AKS", "Azure AD|Entra ID|Azure Active Directory",
    "Cosmos DB", "Azure SQL", "Azure Data Factory", "GKE", "BigQuery", "Cloud Run", "Cloud Functions", "Pub/Sub",
    "Firebase", "Firestore", "Dataflow", "Heroku", "Vercel", "Netlify", "DigitalOcean", "Cloudflare", "OpenStack",
    "VMware", "vSphere", "Hyper-V", "Vagrant", "Packer",
    "Docker|containers|containerisation|containerization", "Docker Compose", "Podman", "Kubernetes|K8s", "Helm",
    "Kustomize", "OpenShift", "Rancher", "Istio", "Linkerd", "Envoy", "service mesh",
    "Terraform", "OpenTofu", "Pulumi", "AWS CDK|CDK", "Ansible", "Puppet", "Chef", "SaltStack|Salt",
    "infrastructure as code|IaC", "configuration management",
    "CI/CD|CI CD|continuous integration|continuous delivery|continuous deployment",
    "Jenkins", "GitHub Actions", "GitLab CI|GitLab CI/CD", "CircleCI", "Travis CI", "TeamCity", "Argo CD|ArgoCD",
    "Flux|FluxCD", "Spinnaker", "Octopus Deploy",
    "Prometheus", "Grafana", "Datadog", "New Relic", "Dynatrace", "AppDynamics", "Splunk",
    "ELK|Elastic Stack|ELK Stack", "Elasticsearch", "Logstash", "Kibana", "Loki", "Jaeger", "Zipkin",
    "OpenTelemetry", "Sentry", "PagerDuty", "Opsgenie", "Nagios", "Zabbix", "Sumo Logic",
    "observability", "monitoring", "alerting", "logging",
    "incident response|incident management", "on-call|on call", "SLOs|SLO|service level objectives",
    "SLAs|SLA|service level agreements", "SLIs|SLI", "error budgets|error budget",
    "postmortems|post-mortems|postmortem|post-incident reviews", "root cause analysis|RCA", "runbooks|runbook",
    "chaos engineering", "site reliability engineering|SRE", "DevOps", "platform engineering", "release management",
    "high availability", "disaster recovery", "business continuity", "backup and recovery", "capacity planning",
    "performance tuning", "cost optimisation|cost optimization|FinOps", "autoscaling|auto-scaling",
    "Linux", "Ubuntu", "Red Hat|RHEL|Red Hat Enterprise Linux", "CentOS", "Debian", "Unix", "Windows Server",
    "Nginx", "Apache|Apache HTTP Server", "HAProxy", "Tomcat", "IIS",
    "networking", "TCP/IP", "DNS", "DHCP", "BGP", "OSPF", "VLANs|VLAN", "VPN", "firewalls|firewall", "load balancing",
    "CDN", "SD-WAN", "Cisco", "Juniper", "Palo Alto Networks|Palo Alto",
    "Kafka|Apache Kafka", "RabbitMQ", "ActiveMQ", "NATS", "Redis", "Memcached", "Vault|HashiCorp Vault", "Consul",

    /* ---------- Data, analytics, databases ---------- */
    "PostgreSQL|Postgres", "MySQL", "MariaDB", "SQL Server|MSSQL|Microsoft SQL Server", "Oracle|Oracle Database",
    "SQLite", "MongoDB", "Cassandra", "Couchbase", "CouchDB", "Neo4j", "InfluxDB", "TimescaleDB", "ClickHouse",
    "Snowflake", "Databricks", "Synapse|Azure Synapse", "Teradata", "Hive|Apache Hive", "Presto|Trino",
    "Spark|Apache Spark|PySpark", "Hadoop", "HDFS", "Flink|Apache Flink", "Beam|Apache Beam",
    "Airflow|Apache Airflow", "dbt", "Dagster", "Fivetran", "Talend", "Informatica", "SSIS", "SSRS", "SSAS",
    "ETL|ELT", "data pipelines|data pipeline", "data engineering", "data warehousing|data warehouse",
    "data lakes|data lake|lakehouse", "data modelling|data modeling", "dimensional modelling|dimensional modeling|star schema",
    "data governance", "data quality", "master data management|MDM", "data migration", "data integration",
    "data analysis|data analytics", "data visualisation|data visualization", "business intelligence|BI",
    "dashboards|dashboard", "management reporting|MI reporting", "KPIs|KPI|key performance indicators",
    "Power BI|PowerBI", "Tableau", "Looker", "Looker Studio|Google Data Studio|Data Studio", "Qlik|QlikView|Qlik Sense",
    "Metabase", "Superset|Apache Superset", "Excel|Microsoft Excel|MS Excel", "Google Sheets", "pivot tables|pivot table",
    "VLOOKUP|XLOOKUP", "Power Query", "DAX", "Power Automate", "Power Apps|PowerApps", "Alteryx",
    "statistics|statistical analysis", "regression analysis|regression modelling", "hypothesis testing",
    "A/B testing|AB testing|split testing|experimentation", "forecasting", "time series|time-series analysis",
    "predictive modelling|predictive modeling|predictive analytics", "data mining", "quantitative analysis",
    "qualitative analysis", "survey design", "Google Analytics|GA4", "Adobe Analytics", "Mixpanel", "Amplitude",
    "Hotjar", "FullStory", "Optimizely", "LaunchDarkly", "Segment",

    /* ---------- Machine learning and AI ---------- */
    "machine learning|ML", "deep learning", "AI|artificial intelligence", "NLP|natural language processing",
    "computer vision", "LLMs|LLM|large language models", "generative AI|GenAI", "prompt engineering",
    "RAG|retrieval-augmented generation", "fine-tuning", "MLOps", "feature engineering", "model deployment",
    "reinforcement learning", "recommender systems|recommendation systems", "neural networks",
    "PyTorch", "TensorFlow", "Keras", "scikit-learn|sklearn", "XGBoost", "LightGBM", "Hugging Face", "LangChain",
    "OpenAI", "pandas", "NumPy", "SciPy", "Matplotlib", "Seaborn", "Plotly", "Jupyter|Jupyter Notebook",
    "RStudio", "SAS", "SPSS", "Stata", "MLflow", "Kubeflow", "Vertex AI", "OpenCV", "spaCy", "NLTK",

    /* ---------- Security ---------- */
    "cybersecurity|cyber security|information security|InfoSec", "application security|AppSec", "network security",
    "cloud security", "penetration testing|pen testing|pentesting", "vulnerability management",
    "vulnerability assessment|vulnerability assessments", "threat modelling|threat modeling", "threat intelligence",
    "SOC|security operations centre|security operations center", "SIEM", "SOAR", "EDR",
    "IDS/IPS|intrusion detection", "zero trust", "PAM|privileged access management", "MFA|multi-factor authentication",
    "SSO|single sign-on", "encryption", "PKI", "OWASP", "Burp Suite", "Metasploit", "Nmap", "Wireshark",
    "Kali Linux", "CrowdStrike", "Microsoft Sentinel|Azure Sentinel", "Okta", "Qualys", "Nessus", "Tenable",
    "ISO 27001", "SOC 2", "NIST|NIST CSF", "GDPR", "HIPAA", "PCI DSS|PCI-DSS", "SOX|Sarbanes-Oxley", "DevSecOps",
    "secure coding", "security audits|security audit", "risk assessments|risk assessment",

    /* ---------- Design and UX ---------- */
    "Figma", "Sketch", "Adobe XD", "InVision", "Miro", "FigJam", "Framer", "Zeplin", "Axure", "Balsamiq",
    "Photoshop|Adobe Photoshop", "Illustrator|Adobe Illustrator", "InDesign|Adobe InDesign",
    "After Effects|Adobe After Effects", "Premiere Pro|Adobe Premiere", "Lightroom",
    "Adobe Creative Suite|Adobe Creative Cloud|Creative Cloud", "Canva", "Blender", "Cinema 4D", "Autodesk Maya",
    "3ds Max", "Final Cut Pro", "DaVinci Resolve", "Procreate",
    "UX|user experience", "UI|user interface", "UX research|user research", "usability testing", "user testing",
    "user interviews", "personas", "journey mapping|customer journey mapping|user journeys",
    "wireframing|wireframes", "prototyping|prototypes", "design systems|design system", "interaction design",
    "visual design", "information architecture", "accessibility|WCAG|a11y", "design thinking", "typography",
    "motion design|motion graphics", "graphic design", "brand identity", "UX writing|content design",
    "service design", "product design", "video editing", "video production", "photography", "illustration",

    /* ---------- Product, project and delivery ---------- */
    "product management", "product strategy", "product roadmap|roadmapping|roadmaps", "product discovery",
    "product-led growth|PLG", "go-to-market|GTM|go to market", "user stories", "acceptance criteria",
    "backlog management|backlog grooming|backlog refinement", "OKRs|OKR", "PRDs|product requirements documents",
    "market research", "competitive analysis|competitor analysis", "customer discovery", "MVP|minimum viable product",
    "feature flags", "Pendo", "Productboard",
    "Agile", "Scrum", "Kanban", "Lean", "SAFe|Scaled Agile", "waterfall", "sprint planning", "retrospectives",
    "project management", "programme management|program management", "portfolio management", "PMO",
    "stakeholder management|stakeholder engagement", "risk management", "change management",
    "resource planning|resource management", "budgeting|budget management", "scope management", "project planning",
    "Gantt charts|Gantt", "MS Project|Microsoft Project", "Smartsheet", "Wrike", "vendor management|supplier management",
    "requirements gathering", "business analysis", "business case|business cases", "process mapping",
    "strategic planning|strategic thinking", "operational planning",

    /* ---------- Marketing ---------- */
    "SEO|search engine optimisation|search engine optimization", "SEM|search engine marketing",
    "PPC|pay-per-click", "paid search", "paid social", "Google Ads|AdWords", "Meta Ads|Facebook Ads",
    "LinkedIn Ads", "TikTok Ads", "Microsoft Ads|Bing Ads", "programmatic advertising|programmatic",
    "display advertising", "affiliate marketing", "influencer marketing", "content marketing", "content strategy",
    "copywriting", "email marketing", "marketing automation", "lifecycle marketing|CRM marketing",
    "growth marketing", "performance marketing", "demand generation|demand gen", "lead generation",
    "account-based marketing|ABM", "product marketing", "brand marketing", "brand strategy", "brand management",
    "social media marketing|social media", "community management", "public relations", "media relations",
    "press releases|press release", "event marketing|event management", "market segmentation|customer segmentation",
    "conversion rate optimisation|conversion rate optimization|CRO", "landing pages", "marketing analytics",
    "attribution modelling|attribution modeling|marketing attribution", "Google Tag Manager",
    "Google Search Console|Search Console", "SEMrush|Semrush", "Ahrefs", "HubSpot", "Marketo",
    "Pardot|Account Engagement", "Salesforce Marketing Cloud", "Mailchimp", "Klaviyo", "Braze", "Hootsuite",
    "Sprout Social", "Sprinklr", "Brandwatch", "CMS|content management system", "marketing strategy",
    "campaign management", "customer acquisition", "retention marketing", "CAC|customer acquisition cost",
    "LTV|lifetime value|CLV|customer lifetime value", "ROAS", "copy editing|copyediting", "proofreading",

    /* ---------- Sales and customer ---------- */
    "B2B", "B2C", "SaaS", "account management", "key account management", "business development",
    "pipeline management", "lead qualification", "prospecting", "cold calling", "outbound sales", "inbound sales",
    "consultative selling|solution selling", "MEDDIC|MEDDPICC", "SPIN selling", "Challenger Sale",
    "negotiation|negotiating", "territory management", "channel sales|partner management", "enterprise sales",
    "inside sales", "field sales", "sales operations|Sales Ops", "revenue operations|RevOps",
    "CRM|customer relationship management", "Salesforce", "Pipedrive", "Zoho CRM|Zoho",
    "Microsoft Dynamics|Dynamics 365", "Gong", "Salesloft", "LinkedIn Sales Navigator|Sales Navigator", "ZoomInfo",
    "customer success", "customer retention", "churn reduction|churn", "upselling|upsell|cross-selling",
    "renewals", "client onboarding|customer onboarding", "NPS|Net Promoter Score", "CSAT",
    "customer service", "customer support", "Zendesk", "Intercom", "Freshdesk", "ServiceNow", "Gainsight",
    "escalation management|escalations", "complaint handling|complaints handling", "relationship building",
    "client management|client relationship management", "sales forecasting", "quota attainment",

    /* ---------- Finance and accounting ---------- */
    "accounting", "bookkeeping", "financial reporting", "management accounts|management accounting",
    "financial analysis", "financial modelling|financial modeling", "FP&A|financial planning and analysis",
    "variance analysis", "cash flow management|cash flow forecasting|cash flow", "P&L|profit and loss",
    "balance sheet", "month-end close|month end close|month-end|year-end close",
    "reconciliations|account reconciliation|bank reconciliations|reconciliation", "accounts payable",
    "accounts receivable", "general ledger", "payroll", "VAT", "tax compliance", "corporate tax", "audit|auditing",
    "internal audit", "external audit", "IFRS", "GAAP|US GAAP|UK GAAP", "treasury", "credit control",
    "credit risk", "market risk", "valuation|valuations", "DCF|discounted cash flow",
    "M&A|mergers and acquisitions", "due diligence", "investment analysis", "equity research", "private equity",
    "venture capital", "capital markets", "fixed income", "derivatives", "Bloomberg|Bloomberg Terminal", "FactSet",
    "Capital IQ", "Xero", "QuickBooks", "Sage", "NetSuite|Oracle NetSuite", "SAP|SAP S/4HANA|SAP FICO",
    "Oracle Financials", "Workday", "Hyperion", "Anaplan", "Adaptive Insights", "KYC|know your customer",
    "AML|anti-money laundering", "compliance", "regulatory reporting", "Basel III", "Solvency II", "actuarial",
    "underwriting", "claims handling|claims management", "expense management", "invoicing",

    /* ---------- People and HR ---------- */
    "recruitment|recruiting", "talent acquisition", "full-cycle recruiting|full life cycle recruiting|end-to-end recruitment",
    "candidate sourcing|talent sourcing", "employee relations", "employee engagement", "performance management",
    "learning and development|L&D", "training and development", "succession planning", "workforce planning",
    "compensation and benefits|reward", "HRIS", "BambooHR", "SAP SuccessFactors|SuccessFactors", "Greenhouse",
    "iCIMS", "Taleo", "applicant tracking systems|applicant tracking system", "employment law",
    "HR policy|HR policies", "DEI|diversity, equity and inclusion|diversity and inclusion|D&I",
    "organisational development|organizational development", "people analytics|HR analytics",
    "grievances|disciplinary", "onboarding", "employer branding", "HR business partnering|HRBP",

    /* ---------- Operations, supply chain, manufacturing ---------- */
    "supply chain management|supply chain", "logistics", "procurement", "purchasing",
    "strategic sourcing|sourcing strategy", "inventory management|stock control", "warehouse management|warehousing",
    "WMS", "demand planning", "S&OP|sales and operations planning", "MRP", "ERP", "lean manufacturing",
    "Six Sigma", "Lean Six Sigma", "Kaizen", "5S", "continuous improvement", "process improvement",
    "operations management", "facilities management", "health and safety|HSE|EHS|H&S",
    "quality management|QMS", "quality control|QC", "ISO 9001", "GMP|good manufacturing practice", "HACCP",
    "fleet management", "route planning", "import/export|customs clearance", "Incoterms", "production planning",
    "manufacturing", "contract negotiation", "cost reduction", "KPI reporting",

    /* ---------- Healthcare ---------- */
    "patient care", "clinical assessment|clinical assessments", "triage", "wound care", "medication administration",
    "IV therapy|IV cannulation|cannulation", "phlebotomy", "venepuncture|venipuncture", "vital signs|clinical observations",
    "infection control|infection prevention", "care planning|care plans", "discharge planning", "safeguarding",
    "EHR|electronic health records|electronic health record", "EMR|electronic medical records", "Epic Systems",
    "Cerner", "SystmOne", "EMIS", "CPR", "BLS|basic life support", "ACLS", "PALS", "first aid", "mental health",
    "dementia care", "palliative care|end of life care", "paediatrics|pediatrics", "ICU|intensive care",
    "emergency department|A&E", "clinical governance", "clinical audit", "pharmacology", "dispensing",
    "clinical trials", "Good Clinical Practice", "medical devices", "regulatory affairs", "pharmacovigilance",
    "patient safety", "health promotion", "caseload management",

    /* ---------- Education ---------- */
    "curriculum development|curriculum design", "lesson planning", "classroom management",
    "differentiation|differentiated instruction", "formative assessment|assessment for learning",
    "behaviour management|behavior management", "SEN|SEND|special educational needs", "pastoral care",
    "EAL|ESL|English as an additional language", "e-learning|eLearning", "instructional design",
    "LMS|learning management system", "Moodle", "Google Classroom", "tutoring", "student engagement",
    "early years|EYFS", "exam preparation", "parent communication",

    /* ---------- Legal and administration ---------- */
    "contract drafting|drafting contracts|legal drafting", "contract law", "commercial law", "litigation",
    "legal research", "conveyancing", "intellectual property", "data protection", "regulatory compliance",
    "corporate governance", "company secretarial", "e-discovery|eDiscovery", "case management",
    "diary management|calendar management", "minute taking|minute-taking", "data entry", "office management",
    "travel arrangements|travel booking", "Microsoft Office|MS Office|Office 365|Microsoft 365",
    "Microsoft Word|MS Word", "PowerPoint|Microsoft PowerPoint", "Outlook|Microsoft Outlook", "SharePoint",
    "Google Workspace|G Suite", "record keeping|records management",

    /* ---------- Engineering, construction and trades ---------- */
    "AutoCAD", "Revit", "BIM|building information modelling|building information modeling", "SolidWorks", "CATIA",
    "Creo", "Fusion 360", "ANSYS", "FEA|finite element analysis", "CFD|computational fluid dynamics", "GD&T",
    "PLC|PLC programming", "SCADA", "HVAC", "electrical installation", "estimating|cost estimation",
    "quantity surveying", "site management", "RAMS|method statements", "CAD", "3D modelling|3D modeling",
    "technical drawings", "welding", "CNC|CNC machining", "preventive maintenance|planned maintenance|preventative maintenance",
    "troubleshooting", "commissioning", "SketchUp",

    /* ---------- Working skills ---------- */
    "cross-functional collaboration|cross-functional teams", "people management|line management",
    "team leadership|leading teams", "coaching", "mentoring", "public speaking", "presentation skills|presentations",
    "written communication", "verbal communication", "communication skills", "problem solving|problem-solving",
    "critical thinking", "analytical skills", "attention to detail", "time management",
    "prioritisation|prioritization", "decision making|decision-making", "conflict resolution",
    "commercial awareness", "report writing", "technical writing", "documentation", "emotional intelligence",

    /* ---------- Spoken languages ---------- */
    "English", "Spanish", "French", "German", "Mandarin|Chinese", "Cantonese", "Arabic", "Portuguese", "Italian",
    "Japanese", "Hindi", "Russian", "Dutch", "Korean", "Polish", "Turkish", "Urdu", "Bengali", "Welsh", "Irish",

    /* ---------- Certifications ---------- */
    "!AWS Certified Solutions Architect|AWS Solutions Architect|AWS Solutions Architect – Associate|AWS Solutions Architect - Associate",
    "!AWS Certified Developer", "!AWS Certified SysOps Administrator", "!AWS Certified DevOps Engineer",
    "!AWS Certified Cloud Practitioner", "!CKA|Certified Kubernetes Administrator",
    "!CKAD|Certified Kubernetes Application Developer", "!CKS|Certified Kubernetes Security Specialist",
    "!Terraform Associate|HashiCorp Certified Terraform Associate", "!Azure Fundamentals|AZ-900",
    "!Azure Administrator|AZ-104", "!Azure Developer|AZ-204", "!Azure Solutions Architect|AZ-305",
    "!Google Cloud Professional|Professional Cloud Architect", "!Google Professional Data Engineer",
    "!RHCSA", "!RHCE", "!CompTIA A+", "!Security+|CompTIA Security+", "!Network+|CompTIA Network+", "!CCNA", "!CCNP",
    "!CCIE", "!CISSP", "!CISM", "!CISA", "!CRISC", "!CEH|Certified Ethical Hacker", "!OSCP", "!ISTQB", "!TOGAF",
    "!PMP|Project Management Professional", "!CAPM", "!PMI-ACP", "!PRINCE2", "!AgilePM",
    "!CSM|Certified ScrumMaster|Certified Scrum Master", "!PSM|Professional Scrum Master", "!SAFe Agilist",
    "!ITIL", "!CBAP", "!CPA", "!ACCA", "!CIMA", "!ACA|ICAEW", "!AAT", "!CFA", "!CIPS", "!CIPD", "!SHRM-CP",
    "!Six Sigma Green Belt", "!Six Sigma Black Belt", "!NEBOSH", "!IOSH", "!CSCS", "!SMSTS", "!18th Edition",
    "!Gas Safe", "!QTS|qualified teacher status", "!PGCE", "!CELTA", "!TEFL|TESOL",
    "!Salesforce Administrator|Salesforce Certified Administrator", "!Google Analytics Certification|GAIQ",
    "!Google Ads Certification"
  ];

  /* Terms that count as "related" evidence for another keyword (shown as Partial). */
  var RELATED = {
    "CI/CD": ["GitLab CI", "GitHub Actions", "Jenkins", "CircleCI", "Travis CI", "Azure DevOps", "Argo CD", "TeamCity", "Spinnaker"],
    "infrastructure as code": ["Terraform", "CloudFormation", "Pulumi", "Ansible", "AWS CDK", "OpenTofu"],
    "Kubernetes": ["EKS", "GKE", "AKS", "OpenShift", "Rancher", "Helm"],
    "Docker": ["Kubernetes", "Podman", "Docker Compose"],
    "AWS": ["EC2", "S3", "Lambda", "CloudFormation", "ECS", "EKS", "DynamoDB", "Redshift", "RDS", "SageMaker", "CloudWatch"],
    "Azure": ["AKS", "Azure DevOps", "Azure Functions", "Cosmos DB", "Azure SQL", "Azure Data Factory"],
    "Google Cloud": ["GKE", "BigQuery", "Cloud Run", "Firebase", "Pub/Sub", "Dataflow"],
    "SQL": ["PostgreSQL", "MySQL", "SQL Server", "Oracle", "SQLite", "BigQuery", "Snowflake", "Redshift", "T-SQL", "PL/SQL", "MariaDB"],
    "NoSQL": ["MongoDB", "Cassandra", "DynamoDB", "Couchbase", "Redis", "Cosmos DB", "Firestore"],
    "JavaScript": ["TypeScript", "React", "Node.js", "Vue", "Angular", "jQuery", "Next.js"],
    "TypeScript": ["JavaScript"],
    "React": ["React Native", "Next.js", "Redux"],
    "Node.js": ["Express", "NestJS"],
    "Python": ["Django", "Flask", "FastAPI", "pandas", "PySpark"],
    "Java": ["Spring", "Kotlin", "Hibernate"],
    "monitoring": ["Prometheus", "Grafana", "Datadog", "New Relic", "Splunk", "Dynatrace", "CloudWatch", "Nagios"],
    "observability": ["Prometheus", "Grafana", "Datadog", "OpenTelemetry", "New Relic", "Honeycomb", "Jaeger"],
    "incident response": ["on-call", "postmortems", "PagerDuty", "Opsgenie", "root cause analysis"],
    "Linux": ["Ubuntu", "Red Hat", "CentOS", "Debian", "Bash"],
    "networking": ["TCP/IP", "DNS", "BGP", "VPN", "Cisco", "VLANs", "load balancing"],
    "machine learning": ["PyTorch", "TensorFlow", "scikit-learn", "deep learning", "XGBoost", "Keras"],
    "deep learning": ["PyTorch", "TensorFlow", "Keras", "neural networks"],
    "data visualisation": ["Tableau", "Power BI", "Looker", "Qlik", "Matplotlib", "Plotly", "Seaborn"],
    "business intelligence": ["Power BI", "Tableau", "Looker", "Qlik", "SSRS"],
    "data analysis": ["SQL", "Excel", "pandas", "Tableau", "Power BI", "Python"],
    "statistics": ["R", "SPSS", "SAS", "Stata", "hypothesis testing", "regression analysis"],
    "ETL": ["Airflow", "dbt", "Informatica", "Talend", "SSIS", "Fivetran", "AWS Glue"],
    "test automation": ["Selenium", "Cypress", "Playwright", "Appium", "Puppeteer"],
    "unit testing": ["Jest", "pytest", "JUnit", "Mocha", "RSpec", "Vitest"],
    "SIEM": ["Splunk", "Microsoft Sentinel", "Elasticsearch"],
    "IAM": ["Okta", "Active Directory", "SSO", "Azure AD"],
    "cybersecurity": ["penetration testing", "SIEM", "vulnerability management", "ISO 27001", "SOC"],
    "Agile": ["Scrum", "Kanban", "SAFe"],
    "project management": ["Agile", "Scrum", "PRINCE2", "PMP", "MS Project", "Smartsheet"],
    "stakeholder management": ["relationship building", "client management"],
    "people management": ["team leadership", "coaching", "mentoring"],
    "team leadership": ["people management", "coaching", "mentoring"],
    "CRM": ["Salesforce", "HubSpot", "Microsoft Dynamics", "Zoho CRM", "Pipedrive"],
    "marketing automation": ["HubSpot", "Marketo", "Pardot", "Mailchimp", "Klaviyo", "Braze"],
    "email marketing": ["Mailchimp", "Klaviyo", "Braze", "marketing automation", "HubSpot"],
    "paid social": ["Meta Ads", "LinkedIn Ads", "TikTok Ads"],
    "paid search": ["Google Ads", "Microsoft Ads", "PPC"],
    "PPC": ["Google Ads", "Microsoft Ads", "paid search"],
    "SEO": ["Ahrefs", "SEMrush", "Google Search Console"],
    "social media marketing": ["Hootsuite", "Sprout Social", "paid social", "community management"],
    "ERP": ["SAP", "NetSuite", "Oracle Financials", "Microsoft Dynamics", "Workday"],
    "accounting": ["Xero", "QuickBooks", "Sage", "bookkeeping", "reconciliations"],
    "bookkeeping": ["Xero", "QuickBooks", "Sage"],
    "financial modelling": ["DCF", "valuation", "Excel"],
    "financial reporting": ["management accounts", "month-end close", "IFRS", "GAAP"],
    "EHR": ["Epic Systems", "Cerner", "SystmOne", "EMIS"],
    "LMS": ["Moodle", "Google Classroom"],
    "Microsoft Office": ["Excel", "Microsoft Word", "PowerPoint", "Outlook"],
    "CAD": ["AutoCAD", "SolidWorks", "Revit", "CATIA", "Creo", "Fusion 360", "SketchUp"],
    "BIM": ["Revit"],
    "HRIS": ["Workday", "BambooHR", "SAP SuccessFactors"],
    "applicant tracking systems": ["Greenhouse", "iCIMS", "Taleo", "Workday"],
    "recruitment": ["talent acquisition", "candidate sourcing", "full-cycle recruiting"],
    "Adobe Creative Suite": ["Photoshop", "Illustrator", "InDesign", "After Effects", "Premiere Pro"],
    "UX research": ["usability testing", "user interviews", "user testing"],
    "prototyping": ["Figma", "Framer", "Axure", "Adobe XD"],
    "customer service": ["customer support", "Zendesk", "complaint handling"],
    "customer support": ["customer service", "Zendesk", "Intercom", "Freshdesk"],
    "supply chain management": ["logistics", "procurement", "inventory management", "demand planning"],
    "continuous improvement": ["Kaizen", "Lean", "Six Sigma", "process improvement"],
    "process improvement": ["Lean", "Six Sigma", "Kaizen", "continuous improvement"],
    "quality management": ["ISO 9001", "quality control", "Six Sigma"],
    "health and safety": ["NEBOSH", "IOSH", "risk assessments", "RAMS"],
    "containers": ["Docker", "Kubernetes"]
  };

  /* Only match with this exact capitalisation (everyday words or names otherwise). */
  var CASE_SENSITIVE = [
    "Go", "R", "C", "Ruby", "Rust", "Swift", "Dart", "Julia", "Lean", "Spark", "Node", "Express", "Apache", "Oracle",
    "Chef", "Puppet", "Spring", "Rails", "Lambda", "Vault", "Consul", "Helm", "SAS", "Excel", "Outlook", "Sketch",
    "Slack", "Sage", "Workday", "Asana", "Notion", "Unity", "Bootstrap", "Hive", "Beam", "Flask", "Jest", "Mocha",
    "Cucumber", "Postman", "Playwright", "Cypress", "Looker", "Superset", "Sentry", "Envoy", "Jaeger", "Loki",
    "Snowflake", "Athena", "Aurora", "Miro", "Framer", "Blender", "Electron", "Ionic", "Qt", "Gong", "Intercom",
    "Greenhouse", "Salt", "Flux", "Segment", "Packer", "Creo", "Gatsby", "Ember", "Celery", "Maven", "Deno",
    "English", "Spanish", "French", "German", "Mandarin", "Chinese", "Cantonese", "Arabic", "Portuguese", "Italian",
    "Japanese", "Hindi", "Russian", "Dutch", "Korean", "Polish", "Turkish", "Urdu", "Bengali", "Welsh", "Irish",
    "SAFe", "Linux", "Unix", "Agile"
  ];

  /* Words that also need context on their line: a list (commas, slashes, bullets)
     or nearby words of the right kind. "tech" = software/data words; "ops" = process words. */
  var AMBIGUOUS = {
    "Go": "tech", "R": "tech", "C": "tech", "Ruby": "tech", "Julia": "tech", "Dart": "tech", "Swift": "tech",
    "Rust": "tech", "Chef": "tech", "Puppet": "tech", "Spring": "tech", "Express": "tech", "Spark": "tech",
    "Hive": "tech", "Beam": "tech", "Unity": "tech", "Electron": "tech", "Node": "tech", "Salt": "tech",
    "Flux": "tech", "Segment": "tech", "Packer": "tech", "Ember": "tech", "Envoy": "tech", "Vault": "tech",
    "Consul": "tech", "Lean": "ops", "Sage": "fin"
  };
  // Spoken languages: only when the line talks about speaking or fluency ("Fluent French", "Languages: …")
  ["English", "Spanish", "French", "German", "Mandarin", "Chinese", "Cantonese", "Arabic", "Portuguese", "Italian",
   "Japanese", "Hindi", "Russian", "Dutch", "Korean", "Polish", "Turkish", "Urdu", "Bengali", "Welsh", "Irish"]
    .forEach(function (l) { AMBIGUOUS[l] = "lang"; });

  var CONTEXT = {
    tech: /\b(programming|programmer|developer|development|engineer|engineering|software|code|coding|languages?|frameworks?|stack|back-?end|front-?end|full-?stack|apis?|microservices?|scripts?|scripting|cloud|data|database|sql|python|java|javascript|typescript|kotlin|scala|kubernetes|k8s|docker|aws|azure|gcp|linux|statistic\w*|analytics|machine learning|libraries|library|games?|ios|android|devops|infrastructure|automation|terraform|ansible|deploy\w*|server|servers|backend|services|go|golang|rust|ruby|swift|c\+\+|c#|php|node\.?js|react|matlab|spss|stata|sas|tableau)\b/i,
    ops: /\b(six sigma|manufacturing|process(es)?|improvement|kaizen|5s|kanban|methodolog\w*|principles|operations|waste|startup|agile|production|scrum|thinking|practices)\b/i,
    fin: /\b(accounting|accounts|bookkeeping|payroll|finance|financial|ledger|invoic\w*|xero|quickbooks|software|vat)\b/i,
    lang: /\b(fluent|fluency|native|bilingual|languages?|speak\w*|spoken|written|proficien\w*|conversational|business level|c1|c2|b2)\b/i
  };

  ATS.terms = TERMS.map(function (line) {
    var cert = line.charAt(0) === "!";
    var names = (cert ? line.slice(1) : line).split("|");
    return { term: names[0], aliases: names.slice(1), cert: cert };
  });
  ATS.related = RELATED;
  ATS.caseSensitive = {};
  CASE_SENSITIVE.forEach(function (w) { ATS.caseSensitive[w] = 1; });
  ATS.ambiguous = AMBIGUOUS;
  ATS.context = CONTEXT;
})();
