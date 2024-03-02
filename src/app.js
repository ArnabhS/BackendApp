
import cookieParser from "cookie-parser";
import cors from "cors";

const express=require("express");
const app=express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials:true
}));

app.use(express.json({limit:"16kb"}));
app.use(express.urlenoed({extended:true,limit:"16kb"}));
app.use(express.static("public"));
app.use(cookieParser());



export default app;