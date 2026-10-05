# AI Research Assistant

Link - 
https://source-trust-me-bro.vercel.app/

An AI-powered research assistant inspired by tools like Perplexity. The project combines web search, content retrieval, and Large Language Models (LLMs) to research a user's query and generate a contextual answer based on retrieved information.

## Overview

Traditional search engines return a list of links and leave the user to read and combine information manually.

This project automates that research process:

```text
User Query
    ↓
Web Search
    ↓
Relevant Sources
    ↓
Content Extraction
    ↓
LLM Processing
    ↓
Information Synthesis
    ↓
Answer + Sources
```

The goal is to build a system that can **search, understand, and synthesize information** rather than simply returning search results.

## Features

- AI-powered question answering
- Web-based information retrieval
- Source-aware research workflow
- LLM-powered answer generation
- Contextual synthesis of information from multiple sources
- Source/citation presentation
- Automated research pipeline
- Natural-language interaction

## How It Works

### 1. User Query

The user submits a natural-language question.

Example:

```text
What are the latest developments in solid-state batteries?
```

### 2. Web Search

The query is processed and used to retrieve relevant information from the web.

Instead of relying solely on the model's existing knowledge, the system obtains external information that can be used during answer generation.

### 3. Content Retrieval

Relevant search results are processed to obtain useful information from the sources.

The system focuses on extracting information that is relevant to the original question rather than passing entire pages directly to the model.

### 4. LLM Processing

The retrieved information is provided as context to an LLM.

The model analyzes the collected information and produces a coherent response to the original query.

### 5. Answer Generation

The final response combines the retrieved information into a readable answer.

Sources are presented alongside the generated response so that the user can inspect the underlying information.
