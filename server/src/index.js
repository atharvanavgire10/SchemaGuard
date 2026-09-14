const express = require("express");
const cors = require("cors");

const demoRoutes = require("./routes/demoRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "schemaguard-api"
  });
});

app.use("/api/demo", demoRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`SchemaGuard API running on port ${PORT}`);
});