const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const Replicate = require('replicate');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

async function waitForModelToLoad(model) {
    while (true) {
        try {
            const response = await axios.post(
                `https://api-inference.huggingface.co/models/${model}`,
                { inputs: "Test" },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
            if (!response.data.error || response.data.error !== 'Model is currently loading') {
                break;
            }
        } catch (error) {
            if (error.response && error.response.data.error === 'Model is currently loading') {
                console.log('Model is currently loading, waiting...');
                await new Promise(resolve => setTimeout(resolve, 20000)); // 20초 대기
            } else {
                throw error;
            }
        }
    }
}

app.post('/generate-content', async (req, res) => {
    const userInput = req.body.description;
    console.log('Received description:', userInput); // 디버깅용 로그 추가

    if (!userInput) {
        return res.status(400).send({ error: 'Description is required' });
    }

    try {
        await waitForModelToLoad('taeminlee/kogpt2'); // 모델이 로드될 때까지 대기

        // 이미지 생성
        const prompt = `${userInput}, a whimsical storybook illustration, fairytale, vibrant colors, highly detailed, fantasy, in the style of a children's book illustration`;
        const output = await replicate.run(
            "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
            {
                input: {
                    prompt: prompt,
                    scheduler: "K_EULER",
                }
            }
        );

        // 텍스트 변환
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/taeminlee/kogpt2',
            { inputs: userInput },
            {
                headers: {
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const textOutput = response.data;

        console.log('Prediction response:', output); // 디버깅용 로그 추가
        res.send({ image_url: output[0], story_text: textOutput[0].generated_text });
    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).send({ error: 'Failed to generate content' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});