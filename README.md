# Provenance #
I built Provenance because keeping frontend types and client libraries in sync with the backend and manually wiring up database subscriptions is a pain. This CLI automates the glue code so I can just build features. After using it for a few weeks, I concluded that it was slowing doen my workflow so I swtched to manually writing the schema with zod. With enough time, effort, and testing, I don't see why this can't work with minimimal, of not zero code changes, comments, or decoratrors.

## How it works ##
Scans: Looks at express routes and AST processing to extract routes and their related code.  
Analyzes: After writing the routes to the DB, they are pulled for AI analysis. The model outputs the tag, operation ID, parameters, and responses.  
Generates: The CLI uses the AI enhanced DB entries to generate the OpenAPI spec and client library.  


## Setup ##
Before using, make sure dependencies are installed and that the DB is running, migrated, and generated.

## Notes ##
- The DB entries can also be used for security and documentation purposes.
- I copied my monorepo and then removed everthing but the relevant code to this project. This will explain the strange project structure and other artifacts. There were additional API modules that were analyzed.
