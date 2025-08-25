AzureAD+liyi@DESKTOP-295T902 /d/s/l/e/chrome-extension-v3 (copilot/fix-d5156e18-c387-4333-b175-805100d78ec9) [1]> ffmpeg --help
ffmpeg version N-120424-g03b9180fe3-20250731 Copyright (c) 2000-2025 the FFmpeg developers
built with gcc 15.1.0 (crosstool-NG 1.27.0.42_35c1e72)
configuration: --prefix=/ffbuild/prefix --pkg-config-flags=--static --pkg-config=pkg-config --cross-prefix=x86_64-w64-mingw32- --arch=x86_64 --target-os=mingw32 --enable-gpl --enable-version3 --disable-debug --disable-w32threads --enable-pthreads --enable-iconv --enable-zlib --enable-libfribidi --enable-gmp --enable-libxml2 --enable-lzma --enable-fontconfig --enable-libharfbuzz --enable-libfreetype --enable-libvorbis --enable-opencl --disable-libpulse --enable-libvmaf --disable-libxcb --disable-xlib --enable-amf --enable-libaom --enable-libaribb24 --enable-avisynth --enable-chromaprint --enable-libdav1d --enable-libdavs2 --enable-libdvdread --enable-libdvdnav --disable-libfdk-aac --enable-ffnvcodec --enable-cuda-llvm --enable-frei0r --enable-libgme --enable-libkvazaar --enable-libaribcaption --enable-libass --enable-libbluray --enable-libjxl --enable-libmp3lame --enable-libopus --enable-librist --enable-libssh --enable-libtheora --enable-libvpx --enable-libwebp --enable-libzmq --enable-lv2 --enable-libvpl --enable-openal --enable-liboapv --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenh264 --enable-libopenjpeg --enable-libopenmpt --enable-librav1e --enable-librubberband --enable-schannel --enable-sdl2 --enable-libsnappy --enable-libsoxr --enable-libsrt --enable-libsvtav1 --enable-libtwolame --enable-libuavs3d --disable-libdrm --enable-vaapi --enable-libvidstab --enable-vulkan --enable-libshaderc --enable-libplacebo --enable-libvvenc --enable-libx264 --enable-libx265 --enable-libxavs2 --enable-libxvid --enable-libzimg --enable-libzvbi --extra-cflags=-DLIBTWOLAME_STATIC --extra-cxxflags= --extra-libs=-lgomp --extra-ldflags=-pthread --extra-ldexeflags= --cc=x86_64-w64-mingw32-gcc --cxx=x86_64-w64-mingw32-g++ --ar=x86_64-w64-mingw32-gcc-ar --ranlib=x86_64-w64-mingw32-gcc-ranlib --nm=x86_64-w64-mingw32-gcc-nm --extra-version=20250731
libavutil 60. 7.100 / 60. 7.100
libavcodec 62. 8.100 / 62. 8.100
libavformat 62. 1.103 / 62. 1.103
libavdevice 62. 0.100 / 62. 0.100
libavfilter 11. 3.100 / 11. 3.100
libswscale 9. 0.100 / 9. 0.100
libswresample 6. 0.100 / 6. 0.100
Universal media converter
usage: ffmpeg [options] [[infile options] -i infile]... {[outfile options] outfile}...

Getting help:
-h -- print basic options
-h long -- print more options
-h full -- print all options (including all format and codec specific options, very long)
-h type=name -- print all options for the named decoder/encoder/demuxer/muxer/filter/bsf/protocol
See man ffmpeg for detailed description of the options.

Per-stream options can be followed by :<stream_spec> to apply that option to specific streams only. <stream_spec> can be a stream index, or v/a/s for video/audio/subtitle (see manual for full syntax).

Print help / information / capabilities:
-L show license
-h <topic> show help
-version show version
-muxers show available muxers
-demuxers show available demuxers
-devices show available devices
-decoders show available decoders
-encoders show available encoders
-filters show available filters
-pix_fmts show available pixel formats
-layouts show standard channel layouts
-sample_fmts show available audio sample formats

Global options (affect whole program instead of just one file):
-v <loglevel> set logging level
-y overwrite output files
-n never overwrite output files
-print_graphs print execution graph data to stderr
-print_graphs_file <filename> write execution graph data to the specified file
-print_graphs_format <format> set the output printing format (available formats are: default, compact, csv, flat, ini, json, xml, mermaid, mermaidhtml)
-stats print progress report during encoding

Per-file options (input and output):
-f <fmt> force container format (auto-detected otherwise)
-t <duration> stop transcoding after specified duration
-to <time_stop> stop transcoding after specified time is reached
-ss <time_off> start transcoding at specified time

Per-file options (output-only):
-metadata[:<spec>] <key=value> add metadata

Per-stream options:
-c[:<stream_spec>] <codec> select encoder/decoder ('copy' to copy stream without reencoding)
-filter[:<stream_spec>] <filter_graph> apply specified filters to audio/video

Video options:
-r[:<stream_spec>] <rate> override input framerate/convert to given output framerate (Hz value, fraction or abbreviation)
-aspect[:<stream_spec>] <aspect> set aspect ratio (4:3, 16:9 or 1.3333, 1.7777)
-vn disable video
-vcodec <codec> alias for -c:v (select encoder/decoder for video streams)
-vf <filter_graph> alias for -filter:v (apply filters to video streams)
-b <bitrate> video bitrate (please use -b:v)

Audio options:
-aq <quality> set audio quality (codec-specific)
-ar[:<stream_spec>] <rate> set audio sampling rate (in Hz)
-ac[:<stream_spec>] <channels> set number of audio channels
-an disable audio
-acodec <codec> alias for -c:a (select encoder/decoder for audio streams)
-ab <bitrate> alias for -b:a (select bitrate for audio streams)
-af <filter_graph> alias for -filter:a (apply filters to audio streams)

Subtitle options:
-sn disable subtitle
-scodec <codec> alias for -c:s (select encoder/decoder for subtitle streams)
