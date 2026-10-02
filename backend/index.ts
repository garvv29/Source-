import express from "express";
import { tavily } from "@tavily/core";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt";
import OpenAI from "openai";
import { prisma } from "./db";


const client = tavily({apiKey:process.env.TAVILY_API_KEY});
const llmclient = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

const app = express();
app.use(express.json());

// Signup
app.post("/signup",async(req,res)=>{

})

// Signin
app.post("/signin",async(req,res)=>{

})

// Get history
app.get("/history",async(req,res)=>{

})

//specific history
app.post("/history/:hId",async(req ,res)=>{
     
})


//to handle user queries
app.post("/asksource",async (req,res)=>{
    const query = req.body.query;

    if (typeof query !== "string" || query.trim().length === 0) {
        res.status(400).json({ error: "query is required" });
        return;
    }

    //make sure user has access
    //check if indexed (similar query)
    // if no then web search to gather resources (links)
    const searchresponse = await client.search(query,{
        searchDepth:"advanced"
    })

    const searchresults = searchresponse.results;

    //hit the LLM and respond (sources + follow ups)
    const prompt = PROMPT_TEMPLATE.replace(
        "{{WEB_SEARCH_RESULTS}}",JSON.stringify(searchresults)).replace(
        "{{USER_QUERY}}",query
    )

    const result = await llmclient.responses.create({
        model: "openai/gpt-oss-20b",
        instructions: SYSTEM_PROMPT,
        input: prompt,
        stream: true,
    });

    for await (const event of result) {
        if (event.type === "response.output_text.delta") {
            res.write(event.delta);
        }
    }
    res.write("\n<SOURCES>\n");
    
    //stream back the sources and followups
    res.write(JSON.stringify(searchresults.map(result=>({url:result.url}))));
    
    res.write("\n</SOURCES>\n");
    res.end();
});

//to handle followups queries only
app.post("/asksource/followup",async(req,res)=>{
//1.get chat from db
//2.forward the full history to the LLM
//2.5. TODO - Context engg
//3.Stream the response
})
app.listen(3000);
