import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

});