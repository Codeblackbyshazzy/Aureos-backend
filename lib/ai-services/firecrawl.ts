import axios from 'axios';
import { env } from '../env';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

export interface ScrapeResult {
  text: string;
  creditsUsed: number;
}

export async function scrapeAndExtractText(url: string): Promise<ScrapeResult> {
  try {
    const response = await axios.post(
      FIRECRAWL_API_URL,
      {
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        },
      }
    );

    const text = response.data.data?.markdown || response.data.data?.content || '';
    const creditsUsed = response.data.creditsUsed || 1;

    return {
      text,
      creditsUsed,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Firecrawl scraping failed: ${error.response?.data?.error || error.message}`);
    }
    throw error;
  }
}

export async function batchScrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
  const results = await Promise.all(urls.map(url => scrapeAndExtractText(url)));
  return results;
}
