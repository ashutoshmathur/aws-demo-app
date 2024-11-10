import { S3Event } from "aws-lambda";
import { S3 } from "aws-sdk";
import * as csv from "csv-parser";

const s3 = new S3({ region: process.env.AWS_REGION });

export async function handler(event: S3Event): Promise<void> {
  try {
    console.log("[importFileParser] event:", JSON.stringify(event));

    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key;

      if (!key.endsWith(".csv")) {
        console.error("Wrong file extension, only .csv is supported");
        continue;
      }

      console.log(`Processing file: ${key} from bucket: ${bucket}`);

      const s3Stream = s3
        .getObject({
          Bucket: bucket,
          Key: key,
        })
        .createReadStream();

      const result: Record<string, string>[] = [];

      await new Promise((resolve, reject) => {
        s3Stream
          .pipe(csv())
          .on("data", (data: Record<string, string>) => {
            console.log("Parsed CSV record:", JSON.stringify(data));
            result.push(data);
          })
          .on("error", (e) => reject(e))
          .on("end", resolve);
      });

      console.log("Result:", result);

      const newKey = key.replace("uploaded/", "parsed/");
      await s3
        .copyObject({
          Bucket: bucket,
          CopySource: `${bucket}/${key}`,
          Key: newKey,
        })
        .promise();

      await s3
        .deleteObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();

      console.log(`Successfully moved file from ${key} to ${newKey}`);
    }
  } catch (e) {
    console.error("[importFileParser] error:", e);
  }
}