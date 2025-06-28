import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { writeFile } from 'fs/promises';

dotenv.config();

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function generateCleanSrt(
	transcript: string[],
	srt: { content: string; fileName: string }[]
) {
	console.log('🧹 Starting SRT cleaning process...');
	
	try {
		const promises = [];
		for (let i = 0; i < transcript.length; i++) {
			console.log(`🧹 Cleaning SRT ${i + 1}/${transcript.length}`);
			promises.push(cleanSrt(transcript[i], srt[i].content, i));
		}
		
		console.log('⏳ Waiting for all SRT cleaning operations to complete...');
		const responses = await Promise.all(promises);
		console.log('✅ All SRT cleaning operations completed');

		console.log('📝 Writing cleaned SRT files...');
		for (let i = 0; i < srt.length; i++) {
			const response = responses.find((response) => response.i === i);
			if (response) {
				await writeFile(srt[i].fileName, response.content ?? '', 'utf8');
				console.log(`✅ Wrote cleaned SRT file ${i + 1}/${srt.length}`);
			}
		}
		console.log('✅ All SRT files written successfully');
	} catch (error) {
		console.error('❌ Error in generateCleanSrt:', error);
		// If there's an error, just use the original SRT files
		console.log('⚠️ Using original SRT files due to error');
		for (let i = 0; i < srt.length; i++) {
			await writeFile(srt[i].fileName, srt[i].content, 'utf8');
		}
	}
}

async function cleanSrt(transcript: string, srt: string, i: number) {
	try {
		const completion = await openai.chat.completions.create({
			messages: [
				{
					role: 'system',
					content: `The first item I will give you is the correct text, and the next will be the SRT generated from this text which is not totally accurate. Sometimes the srt files just doesn't have words so if this is the case add the missing words to the SRT file which are present in the transcript. Based on the accurate transcript, and the possibly inaccurate SRT file, return the SRT text corrected for inaccurate spelling and such. Make sure you keep the format and the times the same.
                            
                            transcript: 
                            ${transcript}
                            
                            srt file text: 
                            ${srt}`,
				},
			],
			model: 'gpt-4-turbo',
		});

		const content = completion.choices[0].message.content;
		return { content, i };
	} catch (error) {
		console.error(`❌ Error cleaning SRT ${i}:`, error);
		// If there's an error, return the original SRT content
		return { content: srt, i };
	}
}
