//Libraries
require('dotenv').config()
const express = require('express')
const sqlite3 = require('sqlite3').verbose()
const { GoogleGenAI } = require("@google/genai")
const path = require('path')

const app = express()
//Setting the port from the .env file
const intPort = process.env.PORT

//I added simple checks to alert me in the console if the connection fails.
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err){
        console.error("Database Error: " + err.message)
    }
    if (!err){
        console.log("Connected to MyPerfectResume database.")
    }
})

//Creating our tables if they don't already exist.
//serialize() ensures these run in order so the database is ready before we use it.
db.serialize(() => {
    //This table stores the main job history entries.
    db.run(`CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT,
        role TEXT,
        description TEXT
    )`)
    //This table stores 'extras' like skills and awards, separate from work history.
    db.run(`CREATE TABLE IF NOT EXISTS extras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, 
        content TEXT
    )`)
})

//express.json() lets us read JSON data sent from our frontend, and express.static('.') tells the server to serve our index.html and assets.
app.use(express.json())
app.use(express.static('.'))

//Fetches all jobs from the database, newest first, to display on the dashboard.
app.get('/api/jobs', (req, res) => {
    db.all("SELECT * FROM jobs ORDER BY id DESC", [], (err, rows) => {
        if (err){
            return res.status(500).json({ error: err.message })
        }
        res.json(rows)
    })
})

//Saves a new job entry. We destructure the request body to get our company, role, and desc.
app.post('/api/jobs', (req, res) => {
    const { strCompany, strRole, strDesc } = req.body
    db.run(`INSERT INTO jobs (company, role, description) VALUES (?, ?, ?)`, 
    [strCompany, strRole, strDesc], function(err) {
        if (err){
            return res.status(500).json({ error: err.message })
        }
        //Returning the new ID so the frontend can track the new entry.
        res.json({ id: this.lastID })
    })
})

//Removes a specific job using its unique ID from the URL parameters.
app.delete('/api/jobs/:id', (req, res) => {
    db.run(`DELETE FROM jobs WHERE id = ?`, [req.params.id], () => {
        res.json({ message: "Deleted" })
    })
})

//Grabs all our skills, certifications, and awards for the selection list.
app.get('/api/extras', (req, res) => {
    db.all("SELECT * FROM extras ORDER BY id DESC", [], (err, rows) => {
        if (err){
            return res.status(500).json({ error: err.message })
        }
        res.json(rows)
    })
})

//Adds a new skill or award to the 'extras' table.
app.post('/api/extras', (req, res) => {
    const { strType, strContent } = req.body
    db.run(`INSERT INTO extras (type, content) VALUES (?, ?)`, [strType, strContent], function(err){
        if (err){
            return res.status(500).json({ error: err.message })
        }
        res.json({ id: this.lastID })
    })
})

//Removing a skill or award based on its ID.
app.delete('/api/extras/:id', (req, res) => {
    db.run(`DELETE FROM extras WHERE id = ?`, [req.params.id], () => {
        res.json({ message: "Deleted" })
    })
})

//This is where we leverage the Gemini API to polish resume text.
//This is an 'async' function because it has to wait for a response from the Google servers.
app.post('/api/suggest', async (req, res) => {
    try {
        //Checking for the API key in .env to ensure we don't leak credentials in the code.
        const strApiKey = process.env.GEMINI_API_KEY
        if (!strApiKey){
            return res.status(500).json({ error: "Missing API Key" })
        }

        const genAI = new GoogleGenAI(strApiKey)
        const strModel = "gemini-3-flash-preview"

        //The prompt tells the AI exactly what to do: stay professional and don't chat back.
        const strPrompt = `Rewrite the following resume bullet point to be professional and concise. Provide ONLY the rewritten text, no conversational filler or options: ${req.body.strContent}`
        
        //Calling the Gemini model and waiting for the generated text.
        const objResponse = await genAI.models.generateContent({
            model: strModel,
            contents: strPrompt,
        });
        
        //Sending the AI's rewritten text back to the frontend
        res.json({suggestion: objResponse.text})

    } catch (error){
        //Basic error handling for AI downtime or key issues
        console.error("--- DEBUG AI ERROR ---")
        console.error(error)
        res.status(500).json({ error: "AI unavailable." })
    }
});

//Starting the server
app.listen(intPort, () => {
    console.log(`MyPerfectResume running at http://localhost:${intPort}`)
})