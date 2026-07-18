"""
YouTube Transcript Summarizer & Q&A Companion — FastAPI Backend
===============================================================
"""

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import os
import httpx
import asyncio

app = FastAPI(title="TranscriptAI API", version="2.0.0")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves static files if built
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

# Models
class TranscriptRequest(BaseModel):
    url: str

class SummarizeRequest(BaseModel):
    transcript: str
    style: str = "detailed"  # brief | detailed | bullets
    gemini_key: str | None = None
    claude_key: str | None = None

class ChatRequest(BaseModel):
    transcript: str
    question: str
    history: list[dict] = []  # List of {"role": "user"/"assistant", "content": "..."}
    gemini_key: str | None = None
    claude_key: str | None = None

# Helpers
def extract_video_id(url: str) -> str | None:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([A-Za-z0-9_-]{11})",
        r"youtube\.com/shorts/([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None

async def fetch_transcript(video_id: str) -> dict:
    """
    Attempts to fetch transcript using local python library 'youtube-transcript-api'.
    Falls back to a public proxy endpoint if needed.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        # Fetching list to get correct language if available
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        try:
            # Prefer English (manual)
            srt = transcript_list.find_transcript(['en'])
            raw = srt.fetch()
        except Exception:
            try:
                # Try English (auto-generated)
                srt = transcript_list.find_generated_transcript(['en'])
                raw = srt.fetch()
            except Exception:
                try:
                    # Fallback to first available transcript (any language)
                    srt = next(iter(transcript_list))
                    raw = None
                    # Translate to English if possible
                    if srt.is_translatable:
                        try:
                            translated_srt = srt.translate('en')
                            raw = translated_srt.fetch()
                            srt = translated_srt
                        except Exception:
                            pass
                    # If translation failed or wasn't translatable, fetch original language
                    if raw is None:
                        raw = srt.fetch()
                except Exception:
                    raise
        text = " ".join(seg.text for seg in raw)
        duration = raw[-1].start + getattr(raw[-1], "duration", 0) if raw else 0
        
        # Format segments with nice timestamps for the frontend
        segments = []
        for seg in raw:
            segments.append({
                "text": seg.text,
                "start": seg.start,
                "duration": getattr(seg, "duration", 0)
            })
            
        return {
            "text": text,
            "segments": segments,
            "duration": int(duration),
            "source": "youtube_transcript_api"
        }
    except Exception as e:
        # Fallback to public transcript proxy
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    f"https://ytranscript.vercel.app/api/transcript?videoId={video_id}"
                )
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list):
                        text = " ".join(seg.get("text", "") for seg in data)
                        segments = [{
                            "text": seg.get("text", ""),
                            "start": float(seg.get("offset", 0)) / 1000.0,
                            "duration": float(seg.get("duration", 0)) / 1000.0
                        } for seg in data]
                        
                        duration = segments[-1]["start"] if segments else 0
                        return {
                            "text": text,
                            "segments": segments,
                            "duration": int(duration),
                            "source": "vercel_transcript_proxy"
                        }
        except Exception:
            pass
        
        raise HTTPException(
            status_code=400,
            detail=f"Could not retrieve transcripts for this video. The video may not have captions enabled. Original error: {str(e)}"
        )

async def get_video_metadata(video_id: str) -> dict:
    """Fetch basic video metadata from oEmbed (no API key needed)."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"https://www.youtube.com/oembed?url=https://youtube.com/watch?v={video_id}&format=json"
            )
            if r.status_code == 200:
                d = r.json()
                return {
                    "title": d.get("title", "Unknown Title"),
                    "channel": d.get("author_name", "Unknown Channel"),
                    "thumbnail": d.get("thumbnail_url", ""),
                }
    except Exception:
        pass
    return {
        "title": f"YouTube Video ({video_id})",
        "channel": "YouTube Creator",
        "thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    }

# AI Engines
def run_gemini_summary(text: str, style: str, api_key: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    
    if style == "brief":
        prompt = "Write a concise 3-4 sentence summary of the key points discussed in this transcript."
    elif style == "bullets":
        prompt = "Extract the 6-8 most important points from this transcript as clear bullet points starting with '• '. Keep them punchy and structured."
    else:  # detailed
        prompt = """Provide a comprehensive, professional summary of this transcript using the following exact structure:
### **Overview**
(A brief 2-3 sentence description of the video's core topic and intent)

### **Key Topics Covered**
• **[Topic 1 Name]**: Description of what was discussed.
• **[Topic 2 Name]**: Description of what was discussed.
... (include up to 4-5 topics)

### **Key Insights & Takeaways**
• [Insight 1]
• [Insight 2]

### **Conclusion**
(A closing summary sentence)"""

    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(
        f"{prompt}\n\nTranscript:\n{text[:25000]}\n\nRespond ONLY with the formatted markdown summary. No intros or outros."
    )
    return response.text.strip()

def run_claude_summary(text: str, style: str, api_key: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    
    if style == "brief":
        instruction = "Write a concise 3-4 sentence summary of the key points."
    elif style == "bullets":
        instruction = "Extract the 6-8 most important points as clear bullet points starting with •"
    else:  # detailed
        instruction = "Write a detailed structured summary with: Overview (2-3 sentences), Key Topics covered, Main Takeaways, and Conclusion."

    msg = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""You are an advanced YouTube transcript summarizer. {instruction}

Transcript:
{text[:20000]}

Respond ONLY with the summary, no preamble."""
        }]
    )
    return msg.content[0].text.strip()

def run_extractive_fallback(text: str, style: str) -> str:
    """Fallback extractive summarization if no LLM key is available."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 35]
    
    if len(sentences) < 3:
        return "The transcript is too short to generate a meaningful extractive summary.\n\nRaw transcript snippet:\n" + text[:500]
        
    step = max(1, len(sentences) // 8)
    picked = sentences[::step][:8]
    
    if style == "bullets":
        return "### **Key Points (Extracted)**\n\n" + "\n".join(f"• {s}" for s in picked)
    elif style == "brief":
        return "### **Overview (Extracted)**\n\n" + " ".join(picked[:3])
    else:
        overview = " ".join(picked[:2])
        bullets = "\n".join(f"• {s}" for s in picked[2:7])
        conclusion = picked[-1]
        return f"### **Overview (Extracted)**\n{overview}\n\n### **Key Insights**\n{bullets}\n\n### **Conclusion**\n{conclusion}"

# Routes
@app.post("/api/transcript")
async def api_transcript(req: TranscriptRequest):
    vid = extract_video_id(req.url.strip())
    if not vid:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL. Please enter a valid link.")
    
    # Run fetchers concurrently
    meta_task = asyncio.create_task(get_video_metadata(vid))
    transcript_task = asyncio.create_task(fetch_transcript(vid))
    
    meta = await meta_task
    transcript_data = await transcript_task
    
    word_count = len(transcript_data["text"].split())
    read_time = max(1, round(word_count / 200)) # roughly 200 words per minute
    
    return {
        "video_id": vid,
        "title": meta["title"],
        "channel": meta["channel"],
        "thumbnail": meta["thumbnail"],
        "text": transcript_data["text"],
        "segments": transcript_data["segments"],
        "duration": transcript_data["duration"],
        "word_count": word_count,
        "read_time": read_time,
        "source": transcript_data["source"]
    }

@app.post("/api/summarize")
async def api_summarize(req: SummarizeRequest):
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Empty transcript cannot be summarized.")
        
    # Check Gemini key
    gemini_key = req.gemini_key or os.environ.get("GEMINI_API_KEY")
    # Check Claude key
    claude_key = req.claude_key or os.environ.get("ANTHROPIC_API_KEY")
    
    try:
        if gemini_key:
            summary = run_gemini_summary(req.transcript, req.style, gemini_key)
            method = "gemini"
        elif claude_key:
            summary = run_claude_summary(req.transcript, req.style, claude_key)
            method = "claude"
        else:
            summary = run_extractive_fallback(req.transcript, req.style)
            method = "fallback"
            
        return {
            "summary": summary,
            "method": method,
            "style": req.style
        }
    except Exception as e:
        # Fallback to local extractive on API errors
        summary = run_extractive_fallback(req.transcript, req.style)
        return {
            "summary": f"> *Note: AI API call failed, fell back to Extractive summary. Error: {str(e)}*\n\n" + summary,
            "method": "fallback_error",
            "style": req.style
        }

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty. Cannot process Q&A.")
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is empty.")
        
    gemini_key = req.gemini_key or os.environ.get("GEMINI_API_KEY")
    claude_key = req.claude_key or os.environ.get("ANTHROPIC_API_KEY")
    
    context = req.transcript[:20000] # Limit size to avoid context limit issues
    
    # Formulate conversational prompt
    prompt = f"""You are a helpful YouTube Study Assistant. Below is a transcript of a YouTube video.
Answer the user's question accurately using ONLY information mentioned in the transcript.
If the transcript does not contain the answer, say "I cannot find the answer in this video's transcript."
Keep answers concise, clear, and direct.

Transcript:
{context}

Question:
{req.question}
"""
    
    try:
        if gemini_key:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            answer = response.text.strip()
            method = "gemini"
        elif claude_key:
            import anthropic
            client = anthropic.Anthropic(api_key=claude_key)
            msg = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}]
            )
            answer = msg.content[0].text.strip()
            method = "claude"
        else:
            # Fallback search-based answer
            import string
            clean_q = req.question.translate(str.maketrans("", "", string.punctuation)).lower()
            words = clean_q.split()
            stop_words = {
                "what", "how", "why", "who", "where", "when", "which", "whose", "whom",
                "would", "could", "should", "about", "their", "there", "these", "those",
                "other", "under", "above", "through", "after", "before", "shall", "might", 
                "must", "having", "yours", "myself", "himself", "herself", "itself", "ourselves"
            }
            keywords = [w for w in words if len(w) > 3 and w not in stop_words]
            if not keywords:
                # If no keywords left, just use any words > 2
                keywords = [w for w in words if len(w) > 2]
                
            sentences = re.split(r'(?<=[.!?])\s+', req.transcript)
            matches = []
            for s in sentences:
                s_clean = s.translate(str.maketrans("", "", string.punctuation)).lower()
                if keywords and any(kw in s_clean.split() for kw in keywords):
                    matches.append(s.strip())
                    if len(matches) >= 3:
                        break
            
            # If no matches, try a simple substring search of the question
            if not matches:
                for s in sentences:
                    if clean_q in s.lower():
                        matches.append(s.strip())
                        if len(matches) >= 3:
                            break
            
            if matches:
                answer = "Here is what I found in the video matching your keywords:\n\n" + "\n\n".join(f"• ... {m} ..." for m in matches)
            else:
                answer = "I couldn't find any direct matches in the video for your query. Please configure an API key in settings for full AI capabilities."
            method = "fallback"
            
        return {"answer": answer, "method": method}
        
    except Exception as e:
        return {"answer": f"Error communicating with AI service: {str(e)}", "method": "error"}

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "TranscriptAI"}

# Serve compiled React frontend
if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/")
    def root_fallback():
        return {"message": f"Backend API running. Built frontend static files not found at: {STATIC_DIR}"}
