import { Pinecone } from "@pinecone-database/pinecone";
import fetch from "node-fetch";
import fs from "fs";
import { NextResponse } from "next/server";

const HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const MODEL = "intfloat/multilingual-e5-large";

const index = new Pinecone({
  apiKey: PINECONE_API_KEY,
})
  .index("rag-index")
  .namespace("ns1");

export async function POST() {
  const data = JSON.parse(fs.readFileSync("reviews.json", "utf-8"));
  const reviews = data.reviews;
  const processed_data = [];

  for (const review of reviews) {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: review.review }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      throw new Error(`Failed to fetch embeddings: ${response.statusText}`);
    }

    const embeddingResponse = await response.json();

    if (!embeddingResponse || embeddingResponse.length !== 1024) {
      throw new Error("Invalid embedding dimension.");
    }

    processed_data.push({
      values: embeddingResponse,
      id: review.professor,
      metadata: {
        review: review.review,
        subject: review.subject,
        stars: review.stars,
      },
    });
  }
  console.log(`processed_data: ${JSON.stringify(processed_data[0])}`);
  try {
    const namespace = index.namespace("ns1");
    await namespace.upsert(processed_data);
    console.log("All reviews uploaded successfully.");
  } catch (error) {
    console.error("Error uploading to Pinecone:", error);
  }

  return NextResponse(processed_data);
}
