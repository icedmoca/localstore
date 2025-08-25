from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import math

app = FastAPI(title="Advanced Calculator", version="1.0.0")

class Calculation(BaseModel):
    expression: str

class Result(BaseModel):
    result: float
    expression: str

@app.get("/", response_class=HTMLResponse)
async def root():
    return """<!DOCTYPE html><html><head><title>Advanced Calculator</title></head><body><h1>Advanced Calculator</h1><div id=display>0</div></body></html>"""

@app.post("/calculate", response_model=Result)
async def calculate(calc: Calculation):
    try:
        expression = calc.expression
        expression = expression.replace('pi', str(math.pi)).replace('^','**')
        allowed = {k:v for k,v in math.__dict__.items() if not k.startswith('_')}
        result = eval(expression, {"__builtins__": {}}, allowed)
        return Result(result=float(result), expression=calc.expression)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import math

app = FastAPI(title="Advanced Calculator", version="1.0.0")

class Calculation(BaseModel):
    expression: str

class Result(BaseModel):
    result: float
    expression: str

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Advanced Calculator</title>
    </head>
    <body>
        <h1>Advanced Calculator</h1>
        <div id=display>0</div>
        <script>
            async function calc(expr){
                const r = await fetch('/calculate', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({expression: expr})});
                const j = await r.json();
                document.getElementById('display').textContent = r.ok ? j.result : ('Error: ' + j.detail);
            }
        </script>
    </body>
    </html>
    """

@app.get("/ping")
async def ping():
    return {"ok": True}

@app.post("/calculate", response_model=Result)
async def calculate(calc: Calculation):
    try:
        expression = calc.expression
        expression = expression.replace('pi', str(math.pi)).replace('^','**')
        allowed = {k:v for k,v in math.__dict__.items() if not k.startswith('_')}
        result = eval(expression, {"__builtins__": {}}, allowed)
        return Result(result=float(result), expression=calc.expression)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
