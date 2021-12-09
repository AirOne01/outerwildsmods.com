import sharp, { FitEnum } from 'sharp';
import fs, { promises as fsp } from 'fs';
import path from 'path';

const getPath = (relativePath: string) => path.join(process.cwd(), relativePath);

const hash = (input: string) => {
	let hash = 0,
		i,
		chr;
	if (input.length === 0) return hash;
	for (i = 0; i < input.length; i++) {
		chr = input.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
};

export const downloadImage = async (imageUrl: string, fileName: string): Promise<string | null> => {
	const response = await fetch(imageUrl);

	if (!response.ok) {
		return null;
	}

	const temporaryDirectory = 'tmp/original';

	if (!fs.existsSync(temporaryDirectory)) {
		await fsp.mkdir(temporaryDirectory, { recursive: true });
	}

	const relativeImagePath = `${temporaryDirectory}/${fileName}`;
	const fullImagePath = getPath(relativeImagePath);

	const image = await response.arrayBuffer();
	await fsp.writeFile(fullImagePath, Buffer.from(image));

	return fullImagePath;
};

export const getOptimizedImage = async (
	imageUrl: string,
	resizeWidth?: number,
	resizeHeight?: number,
	fit: keyof FitEnum = 'cover'
): Promise<{
	// TODO type
	imagePath: string;
	width: number;
	height: number;
} | null> => {
	const encodedImageUrl = hash(imageUrl).toString();

	const downloadedImagePath = await downloadImage(imageUrl, encodedImageUrl);

	if (!downloadedImagePath) {
		throw new Error('Failed to download image');
	}

	const sharpImage = sharp(downloadedImagePath);
	const imageMetadata = await sharpImage.metadata();
	const width = resizeWidth ?? imageMetadata.width;
	const height = resizeHeight ?? imageMetadata.height;

	if (!width || !height) {
		throw new Error('failed to read image dimensions');
	}

	const staticDir = 'build';
	const optimizedDir = '/images/optimized';
	const fileOutputDir = `${staticDir}${optimizedDir}`;
	const fileName = `${encodedImageUrl}-w${width}h${height}f${fit}.jpg`;
	const optimizedImagePath = `${fileOutputDir}/${fileName}`;

	if (!fs.existsSync(fileOutputDir)) {
		await fsp.mkdir(fileOutputDir, { recursive: true });
	}

	await sharpImage.resize({ width, height, fit, position: 'left' }).toFile(optimizedImagePath);

	return {
		imagePath: `${optimizedDir}/${fileName}`,
		width,
		height
	};
};
