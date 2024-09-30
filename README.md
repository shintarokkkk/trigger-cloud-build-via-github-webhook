# Webhook proxy function

Google cloud function that receives GitHub webhook post, checks its secret, and fires cloud build webhook trigger if pushed branch name matches regex.

## Usage
```
# select Google Cloud project you want to deploy this function in
gcloud init
# set necessary environment variables
export GITHUB_SECRET=<github webhook secret string>
export BUILD_TRIGGER_URL=<URL of cloud build trigger, including api key and secret>
# for example, "^main$"
export TARGET_BRANCH_REGEX=<regex of target branch>
# compile and deploy
npm run deploy
```

