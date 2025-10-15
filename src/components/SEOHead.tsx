import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  keywords?: string;
  canonical?: string;
  structuredData?: object;
}

export const SEOHead = ({
  title = 'Tabirly - Perili Yerler Databank\'ı',
  description = 'Dünyanın lanetli ve perili yerlerini keşfedin. Tabirly ile gizemli hikayeler, terk edilmiş mekanlar ve paranormal aktiviteler hakkında bilgi edinin.',
  image = '/favicon.svg',
  type = 'website',
  keywords = 'perili yerler, lanetli mekanlar, paranormal aktiviteler, gizemli yerler',
  canonical,
  structuredData,
}: SEOHeadProps) => {
  const location = useLocation();
  const currentUrl = `https://tabirly.com${location.pathname}${location.search}`;
  const canonicalUrl = canonical || currentUrl;

  useEffect(() => {
    // Update document title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);

    // Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', image, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:url', currentUrl, true);

    // Twitter Card tags
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Add structured data if provided
    if (structuredData) {
      let script = document.querySelector('script[type="application/ld+json"][data-dynamic]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-dynamic', 'true');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    }
  }, [title, description, image, type, keywords, currentUrl, canonicalUrl, structuredData]);

  return null;
};
