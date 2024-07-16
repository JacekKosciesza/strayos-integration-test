import { AssumeRoleCommand, Credentials, STSClient } from "@aws-sdk/client-sts";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import fs from "fs";
import pino from "pino";

import { Notification } from "./notification";

dotenv.config();

const streams = [
  { stream: process.stdout },
  { stream: fs.createWriteStream("file.log", { flags: "a" }) },
];

const logger = pino(
  {
    name: "strayos",
    level: "debug",
  },
  pino.multistream(streams)
);

const app = express();
const port = 3001;

app.use(bodyParser.json());

app.post("/", async (req: Request, res: Response) => {
  const notification = req.body as Notification;
  console.log("Received POST request with body:", notification);

  // INFO: let's just test it for the first image in the list
  const image = notification.project.images[0];

  console.log("Downloading image:", image);

  const credentials = await getCredentialsFromAssumedRole();
  await downloadFileFromS3(credentials, image);

  res.status(200).send("Request received successfully!");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

async function getCredentialsFromAssumedRole(): Promise<Credentials> {
  const sts = new STSClient({
    region: process.env.REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const { Credentials } = await sts.send(
    new AssumeRoleCommand({
      RoleArn: process.env.ROLE_ARN,
      RoleSessionName: process.env.ROLE_SESSION_NAME,
    })
  );
  logger.info(Credentials);

  return Credentials;
}

async function downloadFileFromS3(
  credentials: Credentials,
  s3Uri: string
): Promise<void> {
  const s3 = new S3Client({
    region: process.env.REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
  });

  const key = new URL(s3Uri).pathname.slice(1);

  console.log("Downloading file from S3:", key);

  const { Body } = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.BUCKET,
      Key: key,
    })
  );

  await writeFile(basename(key), await Body.transformToByteArray());

  logger.info(Body);
}
