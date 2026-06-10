from dotenv import load_dotenv
from fastapi import FastAPI

# Load environment variables
load_dotenv()

app = FastAPI(
    title="AI Customer Support Agent API",
    description=(
        "Automated CRM query and refund evaluation engine powered by LangGraph."
    ),
    version="0.1.0",
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "AI Customer Support Agent API",
        "version": "0.1.0",
    }
