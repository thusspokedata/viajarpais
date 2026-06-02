import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    /*
      Cloudinary remote pattern para next/image. Las URLs publicas de
      las galerias geograficas (RegionImage, ProvinceImage, etc.) +
      las de Listings se sirven desde `res.cloudinary.com/{cloudName}/
      image/upload/...`. El `pathname` queda en `/**` sin pinear cloud
      especifico — asi staging/prod pueden usar accounts distintas
      sin tocar config.

      Hostname pineado a res.cloudinary.com solamente. NO permitimos
      otros CDNs por defecto: cualquier url publica de imagen que
      pase por next/image debe ser de nuestro Cloudinary.
    */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
