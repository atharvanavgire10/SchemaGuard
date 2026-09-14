const express = require("express");
const demoData = require("../data/demoData");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(demoData);
});

router.get("/scenarios", (req, res) => {
  res.json(demoData.scenarios);
});

module.exports = router;