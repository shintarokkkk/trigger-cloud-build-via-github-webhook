// implementation is based on https://docs.github.com/ja/webhooks/using-webhooks/validating-webhook-deliveries
import * as functions from "@google-cloud/functions-framework";
import { Request, Response } from "@google-cloud/functions-framework";
let encoder = new TextEncoder()

const GITHUB_SECRET = process.env.GITHUB_SECRET
const BUILD_TRIGGER_URL = process.env.BUILD_TRIGGER_URL
const TARGET_BRANCH_REGEX = process.env.TARGET_BRANCH_REGEX

async function verifySignature(secret: string, header: string, payload: string) {
  let parts = header.split("=");
  let sigHex = parts[1];

  let algorithm = { name: "HMAC", hash: { name: 'SHA-256' } };

  let keyBytes = encoder.encode(secret);
  let extractable = false;
  let key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    algorithm,
    extractable,
    ["sign", "verify"],
  );

  let sigBytes = hexToBytes(sigHex);
  let dataBytes = encoder.encode(payload);
  let equal = await crypto.subtle.verify(
    algorithm.name,
    key,
    sigBytes,
    dataBytes,
  );

  return equal;
}

function hexToBytes(hex: string) {
  let len = hex.length / 2;
  let bytes = new Uint8Array(len);

  let index = 0;
  for (let i = 0; i < hex.length; i += 2) {
    let c = hex.slice(i, i + 2);
    let b = parseInt(c, 16);
    bytes[index] = b;
    index += 1;
  }

  return bytes;
}

const isPushedBranchMatchesTarget = (target_ref_str: string): boolean => {
  // "ref" strings are like "refs/heads/main"
  const ref_str_prefix = "refs/heads/"
  if (!target_ref_str.startsWith(ref_str_prefix)) {
    return false
  }
  const pushed_branch_name = target_ref_str.slice(ref_str_prefix.length)
  const target_branch_regex = new RegExp(TARGET_BRANCH_REGEX as string)
  return target_branch_regex.test(pushed_branch_name)
}

const handleWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["x-hub-signature-256"];
  const body = JSON.stringify(req.body)
  let verification_ok = false;
  if (signature && typeof (signature) === "string") {
    verification_ok = await verifySignature(GITHUB_SECRET as string, signature, body)
  } if (!verification_ok) {
    res.status(401).send("Unauthorized: wrong github secret set?");
    return
  }
  const push_target_ref = req.body["ref"]
  if (push_target_ref && isPushedBranchMatchesTarget(push_target_ref)) {
    // sends empty post request to cloud build trigger
    fetch(BUILD_TRIGGER_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }).then((response) => response.text()).then((resp_text) => {
      res.send(`Sent deploy request to cloud build. Response: ${resp_text}`)
    })
      .catch((err) => {
        res.status(500).send(`Failed to send deploy request to cloud build. Response: ${err}`)
      })
    return
  }
  res.send("Do not deploy because pushed branch name does not match target regex")
}

functions.http('webhookProxy', (req, res) => {
  handleWebhook(req, res)
});
