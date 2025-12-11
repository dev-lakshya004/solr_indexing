const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;


app.use(express.json());

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const upload = multer({ dest: 'uploads/' });


app.post('/solr_index/reindex', upload.single('file'), async (req, res) => {
    try {
        const SOLR_CORE = req.query.core;

        if (!SOLR_CORE) {
            return res.status(400).json({ message: "Please provide a Solr core name." });
        }

        const SOLR_URL = `http://localhost:8983/solr/${SOLR_CORE}`;

        if (!req.file) {
            return res.status(400).json({ message: "Please upload a JSON file." });
        }

        const filePath = path.join(__dirname, req.file.path);


        console.log("Deleting old Solr data...");
        await axios.post(`${SOLR_URL}/update?commit=true`, {
            delete: { query: "*:*" }
        }, {
            headers: { "Content-Type": "application/json" }
        });


        console.log("Reading new JSON file...");
        const fileData = fs.readFileSync(filePath, "utf8");


        console.log("Indexing into Solr...");
        await axios.post(
            `${SOLR_URL}/update?commit=true`,
            fileData,
            { headers: { "Content-Type": "application/json" } }
        );


        fs.unlinkSync(filePath);

        return res.json({ message: "Reindex successful!" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "Reindex failed",
            error: err.message
        });
    }
});

app.post("/solr_index/create-core", async (req, res) => {
    try {
        const { coreName } = req.body;

        if (!coreName) {
            return res.status(400).json({ message: "coreName is required" });
        }

        console.log(`Creating core: ${coreName}`);

        const SOLR_URL = `http://localhost:8983/solr`;

        await axios.get(
            `${SOLR_URL}/admin/cores?action=CREATE&name=${coreName}&configSet=_default&configSetBaseDir=/opt/solr-8.9.0/server/solr/configsets`
        );

        return res.json({ message: `Core '${coreName}' created successfully` });

    } catch (err) {
        console.error(err.response?.data || err);
        return res.status(500).json({
            message: "Failed to create core",
            error: err.message,
        });
    }
});

app.post("/solr_index/index", upload.single("file"), async (req, res) => {
    try {
        const { coreName } = req.body;

        if (!coreName) {
            return res.status(400).json({ message: "coreName is required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "Please upload a JSON file" });
        }

        const filePath = path.join(__dirname, req.file.path);


        const jsonData = fs.readFileSync(filePath, "utf8");

        console.log(`Indexing into core: ${coreName}`);

        const SOLR_URL = `http://localhost:8983/solr`;

        await axios.post(
            `${SOLR_URL}/${coreName}/update?commit=true`,
            jsonData,
            { headers: { "Content-Type": "application/json" } }
        );

        fs.unlinkSync(filePath);

        return res.json({ message: "Indexing successful" });

    } catch (err) {
        console.error(err.response?.data || err);
        return res.status(500).json({
            message: "Indexing failed",
            error: err.message,
        });
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Solr Reindex API started on http://localhost:${PORT}`);
});
