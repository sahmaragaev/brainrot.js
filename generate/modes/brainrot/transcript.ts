import dotenv from 'dotenv';
dotenv.config();
import Groq from 'groq-sdk';
import { query } from '../../dbClient';
import { writeFile } from 'fs/promises';
import { generateAudio } from '../../audioGenerator';
import { generateFillerContext } from '../../fillerContext';

interface AudioEntry {
	person: string;
	audio: string;
	index: number;
}

interface TranscriptEntry {
	agentId: string;
	text: string;
}

const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});

const PERSONAS = [
	'JOE_ROGAN',
	'BARACK_OBAMA',
	'BEN_SHAPIRO',
	'DONALD_TRUMP',
	'JOE_BIDEN',
	'KAMALA_HARRIS',
	'ANDREW_TATE'
];

function getRandomPersona() {
	return PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
}

function splitTextIntoLines(text: string): string[] {
	// Split text into sentences and ensure each line is not too long
	const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
	return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

async function generateBrainrotTranscript(
	topic: string,
	agentA: string,
	agentB: string
) {
	console.log('📝 Starting generateTranscript with params:', {
		topic,
		agentA,
		agentB,
	});

	try {
		console.log('🤖 Creating Groq chat completion...');
		const completion = await groq.chat.completions.create({
			messages: [
				{
					role: 'system',
					content: `Create a dialogue for a short-form conversation on the topic of ${topic}. The conversation should be between two agents, ${agentA.replace(
						'_',
						' '
					)} and ${agentB}, who should act as extreme, over-the-top caricatures of themselves with wildly exaggerated personality traits and mannerisms. ${agentA.replace(
						'_',
						' '
					)} and ${agentB.replace(
						'_',
						' '
					)} should both be absurdly vulgar and crude in their language, cursing excessively and making outrageous statements to the point where it becomes almost comically over-the-top. The dialogue should still provide insights into ${topic} but do so in the most profane and shocking way possible. Limit the dialogue to a maximum of ${7} exchanges, aiming for a concise transcript that would last for 1 minute. The agentId attribute should either be ${agentA} or ${agentB}. The text attribute should be that character's line of dialogue. Make it as edgy and controversial as possible while still being funny. Remember, ${agentA} and ${agentB} are both ${agentA.replace(
						'_',
						' '
					)} and ${agentB.replace(
						'_',
						' '
					)} behaving like they would in real life, but more inflammatory. The JSON format WHICH MUST BE ADHERED TO ALWAYS is as follows: { transcript: { [ {'agentId': 'the exact value of ${agentA} or ${agentB} depending on who is talking', 'text': 'their line of conversation in the dialog'} ] } }`,
				},
				{
					role: 'user',
					content: `generate a video about ${topic}. Both the agents should talk about it in a way they would, but extremify their qualities and make the conversation risque so that it would be interesting to watch and edgy.`,
				},
			],
			response_format: { type: 'json_object' },
			model: 'llama3-70b-8192',
			temperature: 0.5,
			max_tokens: 4096,
			top_p: 1,
			stop: null,
			stream: false,
		});

		console.log('✅ Chat completion received');
		const content = completion.choices[0]?.message?.content || '';
		console.log('📄 Content:', content);
		console.log('📄 Content length:', content.length);

		return content;
	} catch (error) {
		console.error('❌ Error in generateTranscript:', error);
		throw error;
	}
}

function delay(ms: number) {
	console.log(`⏳ Delaying for ${ms}ms`);
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function brainrotTranscript(
	topic: string,
	agentA: string,
	agentB: string
) {
	console.log('🎬 Starting transcriptFunction with params:', {
		topic,
		agentA,
		agentB,
	});

	let transcript: Transcript[] | null = null;
	let attempts = 0;

	while (attempts < 5) {
		console.log(`🔄 Attempt ${attempts + 1}/5`);
		try {
			console.log('📝 Generating transcript...');
			const content = await generateBrainrotTranscript(topic, agentA, agentB);

			console.log('🔍 Parsing content...');
			const parsedContent = content === '' ? null : JSON.parse(content);
			// Extract the transcript array from the response
			transcript = parsedContent?.transcript || null;

			if (transcript !== null && Array.isArray(transcript)) {
				console.log('✅ Valid transcript generated');
				console.log('📜 Transcript lines:');
				transcript.forEach((entry, index) => {
					console.log(`${index + 1}. ${entry.agentId}: "${entry.text}"`);
				});
				return transcript;
			} else {
				console.log('⚠️ Invalid or empty transcript received');
			}
		} catch (error) {
			console.error(`❌ Attempt ${attempts + 1} failed:`, error);
			console.log('⏳ Waiting before next attempt...');
			await delay(15000);
		}
		attempts++;
	}

	console.error('❌ All attempts failed');
	throw new Error(
		`Failed to generate valid transcript after 5 attempts for topic: ${topic}`
	);
}

export async function generateBrainrotTranscriptAudio({
	local,
	topic,
	text,
	music,
	videoId,
}: {
	local: boolean;
	topic: string;
	text: string;
	music: string;
	videoId?: string;
}) {
	console.log('⭐ Starting generateTranscriptAudio with params:', {
		local,
		topic,
	});

	try {
		if (!local) {
			console.log('📝 Updating video status - Generating transcript');
			await query(
				"UPDATE `pending-videos` SET status = 'Generating transcript', progress = 0 WHERE video_id = ?",
				[videoId]
			);
		}

		// Split the input text into lines
		const lines = splitTextIntoLines(text);
		console.log('✅ Text split into lines:', lines.length, 'entries');

		const audios: AudioEntry[] = [];
		const selectedPersona = getRandomPersona();
		console.log('🎭 Selected persona for this video:', selectedPersona);

		if (!local) {
			await query(
				"UPDATE `pending-videos` SET status = 'Generating audio', progress = 12 WHERE video_id = ?",
				[videoId]
			);
		}

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			const voice_id =
				selectedPersona === 'JOE_ROGAN'
					? process.env.JOE_ROGAN_VOICE_ID
					: selectedPersona === 'BARACK_OBAMA'
					? process.env.BARACK_OBAMA_VOICE_ID
					: selectedPersona === 'BEN_SHAPIRO'
					? process.env.BEN_SHAPIRO_VOICE_ID
					: selectedPersona === 'DONALD_TRUMP'
					? process.env.DONALD_TRUMP_VOICE_ID
					: selectedPersona === 'JOE_BIDEN'
					? process.env.JOE_BIDEN_VOICE_ID
					: selectedPersona === 'KAMALA_HARRIS'
					? process.env.KAMALA_HARRIS_VOICE_ID
					: process.env.ANDREW_TATE_VOICE_ID;

			await generateAudio(voice_id ?? '', selectedPersona, line, i);
			audios.push({
				person: selectedPersona,
				audio: `public/voice/${selectedPersona}-${i}.mp3`,
				index: i,
			});
		}

		const initialAgentName = selectedPersona;

		let contextContent = `
import { staticFile } from 'remotion';

export const music: string = ${
			music === 'NONE' ? `'NONE'` : `'/music/${music}.MP3'`
		};
export const initialAgentName = '${initialAgentName}';
const videoNumber = Math.floor(Math.random() * 13) + 1;
export const videoFileName = \`/background/video-\${videoNumber}.mp4\`;
export const videoMode = 'brainrot';

export const subtitlesFileName = [
  ${audios
		.map(
			(entry, i) => `{
    name: '${entry.person}',
    file: staticFile('srt/${entry.person}-${i}.srt'),
  }`
		)
		.join(',\n  ')}
];
`;

		await writeFile('src/tmp/context.tsx', contextContent, 'utf-8');

		return { 
			audios, 
			transcript: lines.map((line, i) => ({ 
				agentId: selectedPersona, 
				text: line 
			})) as TranscriptEntry[] 
		};
	} catch (error) {
		console.error('❌ Error in generateTranscriptAudio:', error);
		throw error;
	}
}
