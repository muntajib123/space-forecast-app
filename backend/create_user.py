from pymongo import MongoClient

# Connect without auth (make sure MongoDB isn't enforcing auth yet)
client = MongoClient("mongodb://localhost:27018/")

db = client["noaa_database"]

# Create a user with readWrite on noaa_database
db.command("createUser", "muntajib",
           pwd="7081567123Muntajib",
           roles=[{"role": "readWrite", "db": "noaa_database"}])

print("✅ User created successfully")
