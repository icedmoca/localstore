from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def root():
    return {"hello": "world"}

@app.get("/ping")
def ping():
    return {"pong": True}
