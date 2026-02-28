import os
import requests
from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv()

API_KEY = os.getenv("OPENWEATHER_API_KEY")
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"


def get_weather(city: str = "Farmingdale"):

    # Validate API key
    if not API_KEY:
        return {
            "temperature": None,
            "condition": "Unavailable",
            "location": city,
            "suggestion": "Missing weather API key"
        }

    params = {
        "q": city,
        "appid": API_KEY,
        "units": "imperial"
    }

    try:
        response = requests.get(BASE_URL, params=params, timeout=5)
    except requests.RequestException:
        return {
            "temperature": None,
            "condition": "Unavailable",
            "location": city,
            "suggestion": "Weather service unreachable"
        }

    if response.status_code != 200:
        return {
            "temperature": None,
            "condition": "Unavailable",
            "location": city,
            "suggestion": f"API error: {response.status_code}"
        }

    data = response.json()

    try:
        temperature = data["main"]["temp"]
        condition = data["weather"][0]["main"]
    except (KeyError, TypeError):
        return {
            "temperature": None,
            "condition": "Unavailable",
            "location": city,
            "suggestion": "Malformed weather response"
        }

    if temperature < 50:
        suggestion = "Wear a jacket"
    elif temperature > 80:
        suggestion = "Light clothing recommended"
    else:
        suggestion = "Comfortable weather"

    return {
        "temperature": temperature,
        "condition": condition,
        "location": city,
        "suggestion": suggestion
    }