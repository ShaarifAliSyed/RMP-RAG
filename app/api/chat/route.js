import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

const systemPrompt = `You are a Rate My Professor agent designed to help students find professors based on their specific queries. Your goal is to provide the top 3 professors who best match the user's criteria. Each query should be processed using Retrieval-Augmented Generation (RAG) to ensure accurate and relevant results.

Instructions:

Understand the Query: Analyze the user's question to determine what they are looking for in a professor. This may include specific subjects, teaching styles, ratings, or other preferences.

Retrieve Relevant Information: Use RAG to search and retrieve information about professors from a database or knowledge base. Ensure the data includes details such as professor names, subjects they teach, ratings, and reviews.

Rank Professors: Evaluate the retrieved information to identify the top 3 professors who best meet the user's query. Consider factors like the relevance of the subject, rating, and feedback from other students.

Present Results: Provide a concise and informative response with the top 3 professors. Include key details such as the professor's name, subject, rating, and a brief summary of reviews.

Example:

User Query: "I'm looking for a highly-rated professor for Chemistry who is known for engaging lectures."
Response:
Dr. Emily Johnson - Chemistry 101, Rating: 4.5, "Dr. Johnson is known for her engaging lectures and clear explanations. Students appreciate her enthusiasm for the subject."
Dr. Robert Davis - Chemistry 201, Rating: 4.2, "Dr. Davis is well-regarded for his in-depth knowledge and interactive teaching style. His classes are challenging but rewarding."
Dr. Laura Garcia - Organic Chemistry, Rating: 4.0, "Dr. Garcia is praised for her passion and ability to make complex topics understandable. Her lectures are both informative and interesting."`

export async function POST(req) {
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
    })
    const index = pc.index('rag').namespace('ns1')
    const genAI = new GoogleGenerativeAI(process.env.API_KEY);
    const gemini = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

    // Read data
    const text = data[data.length]
    const embedding = await gemini.embed_content(
        model="models/text-embedding-004",
        content=text,
        task_type="retrieval_document",
        title="Embedding of single review"
    )

    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0].embedding
    })

    // Get embedding
    let resultString = '\n\nReturned results from vector db (done automatically):'
    results.matches.forEach((match) => {
        resultString += `\n
        Professor: ${match.id}
        Review: ${match.metadata.review}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n
        `
    })

    // Generate result with embeddings
    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)
    const completion = await gemini.generateContent({
        contents: [
            {
                role: 'model',
                parts: [{ text: systemPrompt }]
            },
            ...lastDataWithoutLastMessage,
            {
                role: 'user',
                parts: [{ text: lastMessageContent }]
            }
        ],
        generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.1,
        }
    })

    const stream = ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            try {
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content
                    if (content) {
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            }
            catch(err) {
                controller.error(err)
            } 
            finally {
                controller.close()
            }
        }
    })

    return new NextResponse(stream)
}