"use client";
import { Box, Button, Stack, TextField } from "@mui/material";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I am the Rate My Professor support assistant. How can I help you today?",
    },
  ]);

  const [message, setMessage] = useState("");

  const sendMessage = async () => {
    setMessages((messages) => [
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    setMessage("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([...messages, { role: "user", content: message }]),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      const data = await response.json();

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = {
          role: "assistant",
          content: data.content
          .replace(/\*/g, "")
          .replace(/Query:.*?\n/, "") // Remove the query part until \n char
          .replace(/(\d+\.\s)/g, "\n$1") // Add line breaks before each numbered entry,
        };
        return updatedMessages;
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // For uploading reviews.json to the pinecone index
  async function uploadReviews() {
    try {
      const response = await fetch("/api/uploadreview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Error uploading reviews: ${response.status} ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Reviews uploaded successfully:", result);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <Stack
        direction="column"
        width="500px"
        height="700px"
        border="1px solid black"
        p={2}
        spacing={3}
      >
        <Button variant="contained" onClick={uploadReviews}>
          upload Review
        </Button>
        <Stack
          direction="column"
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                message.role === "assistant" ? "flex-start" : "flex-end"
              }
            >
              <Box
                bgcolor={
                  message.role === "assistant"
                    ? "primary.main"
                    : "secondary.main"
                }
                color="white"
                borderRadius={16}
                p={3}
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }} // This will ensure the text formatting is preserved.
              >
                {message.content
                .replace(/\*/g, "") // Remove any asterisks from the content
                .replace(/Query:.*?\n/, "") // Remove the query part until the newline character
                .split("\n")
                .map((line, i) => {
                  if (line.trim().startsWith("- Review:")) {
                    return (
                      <Box key={i} sx={{ textIndent: "0", paddingLeft: "1em" }}>
                        {line.trim()}
                      </Box>
                    );
                  } else if (line.trim().startsWith("Note:")) {
                    // Add spacing before "Note:" and apply specific styling
                    return (
                      <Box key={i} sx={{ marginTop: "1em" }}>
                        {line.trim()}
                      </Box>
                    );
                  } else if (line.trim().startsWith("-")) {
                    return (
                      <Box key={i} sx={{ textIndent: "0", paddingLeft: "1em" }}>
                        {line.trim()}
                      </Box>
                    );
                  } else if (line.trim().match(/^\d+\./)) {
                    // Ensure proper spacing before each numbered entry
                    return (
                      <Box key={i} sx={{ marginTop: "1em" }}>
                        {line.trim()}
                      </Box>
                    );
                  } else {
                    return <Box key={i}>{line.trim()}</Box>;
                  }
                })}
              </Box>
            </Box>
          ))}
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
          />
          <Button variant="contained" onClick={sendMessage}>
            Send
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
