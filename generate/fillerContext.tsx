// this is so that we don't get import errors for other compositions.
export const generateFillerContext = (videoMode: VideoMode) => {
	switch (videoMode) {
		case 'brainrot':
			const videoNumber = Math.floor(Math.random() * 13) + 1;
			return `

            export const music: string = 'NONE';
            export const initialAgentName = 'JORDAN_PETERSON';
            export const videoFileName = '/background/video-${videoNumber}.mp4';
            
            export const subtitlesFileName = [];
            `;
		case 'rap':
			return `

            export const rapper: string = 'SPONGEBOB';
            export const imageBackground: string = '/rap/SPONGEBOB.png';
            `;
		default:
			return '';
	}
};
