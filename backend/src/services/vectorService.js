const pool = require("../config/db");

/**
 * Splits text into overlapping word chunks
 */
function chunkText(text, chunkSize = 300, overlap = 50) {
    if (!text || typeof text !== "string") return [];
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const chunks = [];
    const step = Math.max(1, chunkSize - overlap);

    for (let i = 0; i < words.length; i += step) {
        const chunkWords = words.slice(i, i + chunkSize);
        if (chunkWords.length > 0) {
            chunks.push(chunkWords.join(" "));
        }
    }
    return chunks;
}

/**
 * Saves document chunks and vector embeddings into Supabase PostgreSQL
 */
async function storeDocumentChunksAndEmbeddings(client, documentId, rawText, embeddingsList = null, modelName = "paraphrase-multilingual-MiniLM-L12-v2") {
    const chunks = chunkText(rawText);
    if (chunks.length === 0) return [];

    const insertedChunkIds = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i];

        // 1. Insert chunk
        const chunkRes = await client.query(
            `INSERT INTO document_chunks (document_id, chunk_index, content)
             VALUES ($1, $2, $3)
             ON CONFLICT (document_id, chunk_index) DO UPDATE SET content = EXCLUDED.content
             RETURNING id;`,
            [documentId, i, chunkContent]
        );

        const chunkId = chunkRes.rows[0].id;
        insertedChunkIds.push(chunkId);

        // 2. Insert embedding if vector is provided
        if (embeddingsList && embeddingsList[i]) {
            const vectorString = `[${embeddingsList[i].join(",")}]`;
            try {
                await client.query(
                    `INSERT INTO document_embeddings (chunk_id, embedding, embedding_model)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding, embedding_model = EXCLUDED.embedding_model;`,
                    [chunkId, vectorString, modelName]
                );
            } catch (err) {
                console.warn("[PGVECTOR] Warning storing vector embedding (vector extension may not be active):", err.message);
            }
        }
    }

    return insertedChunkIds;
}

/**
 * Performs semantic vector search on patient documents using PostgreSQL pgvector
 */
async function searchPatientChunksByVector(patientId, queryVector, topK = 5) {
    const vectorString = `[${queryVector.join(",")}]`;

    const sql = `
        SELECT c.id, c.document_id, c.content, c.page_number, d.document_type, d.file_name,
               (e.embedding <=> $1::vector) AS distance
        FROM document_chunks c
        JOIN documents d ON c.document_id = d.id
        JOIN document_embeddings e ON c.id = e.chunk_id
        WHERE d.patient_id = $2
        ORDER BY distance ASC
        LIMIT $3;
    `;

    try {
        const result = await pool.query(sql, [vectorString, patientId, topK]);
        return result.rows;
    } catch (err) {
        console.warn("[PGVECTOR] Vector search failed (falling back to ILIKE search):", err.message);
        return [];
    }
}

module.exports = {
    chunkText,
    storeDocumentChunksAndEmbeddings,
    searchPatientChunksByVector,
};
