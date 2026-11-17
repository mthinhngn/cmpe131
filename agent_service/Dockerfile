# Course Radar agent (FastAPI + LangGraph). Build context is agent_service/ (see vercel.json).
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PORT=80
WORKDIR /app
COPY requirements.txt ./agent_service/requirements.txt
RUN pip install -r agent_service/requirements.txt
COPY . ./agent_service/
EXPOSE 80
CMD ["sh", "-c", "exec uvicorn agent_service.server:asgi --host 0.0.0.0 --port ${PORT:-80} --proxy-headers --forwarded-allow-ips='*'"]
