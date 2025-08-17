from pymongo import MongoClient

# Two URIs to test: with authSource=admin and authSource=noaa_database
uris = [
    "mongodb://muntajib:7081567123Muntajib@localhost:27018/noaa_database?authSource=admin",
    "mongodb://muntajib:7081567123Muntajib@localhost:27018/noaa_database?authSource=noaa_database",
]

for uri in uris:
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        print(f"✅ Connected successfully with: {uri}")
    except Exception as e:
        print(f"❌ Failed with {uri} -> {e}")
