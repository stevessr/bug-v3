#!/usr/bin/env fish

# PNG、JPEG、MP4 转 AVIF 转换脚本
# 保持原始分辨率和质量设置

function convert_to_avif --description '将图片和视频转换为 AVIF 格式'
    argparse 'h/help' 'q/quality=' 'o/output=' 'r/recursive' -- $argv
    or return 1

    if set -q _flag_help
        echo "用法: convert_to_avif [选项] 文件或目录..."
        echo ""
        echo "选项:"
        echo "  -h, --help              显示此帮助信息"
        echo "  -q, --quality=数值      设置图片质量 (1-100, 默认: 80)"
        echo "  -o, --output=目录       指定输出目录 (默认: 当前目录下的 avif_output)"
        echo "  -r, --recursive         递归处理子目录"
        echo ""
        echo "示例:"
        echo "  convert_to_avif image.png"
        echo "  convert_to_avif -q 90 -o ./converted *.jpg *.png"
        echo "  convert_to_avif -r /path/to/images"
        return 0
    end

    # 检查必要的工具
    if not command -v magick >/dev/null 2>&1
        echo "错误: 需要安装 ImageMagick (magick 命令)"
        echo "安装方法:"
        echo "  Ubuntu/Debian: sudo apt install imagemagick"
        echo "  macOS: brew install imagemagick"
        return 1
    end

    if not command -v ffmpeg >/dev/null 2>&1
        echo "错误: 需要安装 FFmpeg"
        echo "安装方法:"
        echo "  Ubuntu/Debian: sudo apt install ffmpeg"
        echo "  macOS: brew install ffmpeg"
        return 1
    end

    # 设置默认参数
    set -l quality (set -q _flag_quality; and echo $_flag_quality; or echo "100")
    set -l output_dir (set -q _flag_output; and echo $_flag_output; or echo "avif_output")
    set -l recursive (set -q _flag_recursive; and echo true; or echo false)

    # 创建输出目录
    mkdir -p $output_dir

    # 支持的文件扩展名
    set -l image_extensions png jpg jpeg jpeg2000 jp2 jpx tiff tif bmp gif
    set -l video_extensions mp4 avi mov mkv webm flv wmv

    function convert_single_file --description '转换单个文件'
        set -l input_file $argv[1]
        set -l filename (basename $input_file)
        set -l extension (echo $filename | sed 's/.*\.//')
        set -l basename (echo $filename | sed 's/\.[^.]*$//')
        set -l output_file "$output_dir/$basename.avif"

        echo "正在转换: $input_file -> $output_file"

        if contains $extension $image_extensions
            # 获取原始图片信息
            set -l width (magick identify -format "%w" $input_file 2>/dev/null)
            set -l height (magick identify -format "%h" $input_file 2>/dev/null)
            
            if test -n "$width" -a -n "$height"
                echo "  原始尺寸: ${width}x${height}"
                
                # 转换图片，保持原始尺寸
                magick convert $input_file \
                    -quality $quality \
                    -define heif:speed=4 \
                    -define heif:chroma=444 \
                    -resize "${width}x${height}!" \
                    $output_file
                
                if test $status -eq 0
                    echo "  ✓ 转换成功"
                    # 显示文件大小对比
                    set -l original_size (stat -f%z $input_file 2>/dev/null || stat -c%s $input_file 2>/dev/null)
                    set -l new_size (stat -f%z $output_file 2>/dev/null || stat -c%s $output_file 2>/dev/null)
                    if test -n "$original_size" -a -n "$new_size"
                        set -l compression_ratio (math "scale=1; ($original_size - $new_size) * 100 / $original_size")
                        echo "  文件大小: $original_size -> $new_size (压缩率: $compression_ratio%)"
                    end
                else
                    echo "  ✗ 转换失败"
                end
            else
                echo "  ✗ 无法获取图片尺寸信息"
            end

        else if contains $extension $video_extensions
            # 获取视频信息
            set -l video_info (ffprobe -v quiet -print_format json -show_streams $input_file 2>/dev/null)
            set -l width (echo $video_info | jq -r '.streams[0].width' 2>/dev/null)
            set -l height (echo $video_info | jq -r '.streams[0].height' 2>/dev/null)
            set -l fps (echo $video_info | jq -r '.streams[0].r_frame_rate' 2>/dev/null)
            set -l bitrate (echo $video_info | jq -r '.streams[0].bit_rate' 2>/dev/null)

            if test -n "$width" -a -n "$height"
                echo "  原始尺寸: ${width}x${height}"
                test -n "$fps"; and echo "  帧率: $fps"
                test -n "$bitrate"; and echo "  比特率: $bitrate"
                
                # 设置默认比特率（如果没有获取到）
                if test -z "$bitrate"
                    set bitrate "2M"
                end

                # 转换视频，保持原始分辨率和帧率
                ffmpeg -i $input_file \
                    -c:v libaom-av1 \
                    -crf (math "100 - $quality") \
                    -b:v $bitrate \
                    -pix_fmt yuv420p \
                    -movflags +faststart \
                    -vf "scale=${width}:${height}" \
                    -r (echo $fps | cut -d'/' -f1) \
                    -y $output_file 2>/dev/null

                if test $status -eq 0
                    echo "  ✓ 转换成功"
                    # 显示文件大小对比
                    set -l original_size (stat -f%z $input_file 2>/dev/null || stat -c%s $input_file 2>/dev/null)
                    set -l new_size (stat -f%z $output_file 2>/dev/null || stat -c%s $output_file 2>/dev/null)
                    if test -n "$original_size" -a -n "$new_size"
                        set -l compression_ratio (math "scale=1; ($original_size - $new_size) * 100 / $original_size")
                        echo "  文件大小: $original_size -> $new_size (压缩率: $compression_ratio%)"
                    end
                else
                    echo "  ✗ 转换失败"
                end
            else
                echo "  ✗ 无法获取视频尺寸信息"
            end
        else
            echo "  跳过不支持的文件格式: $extension"
        end
    end

    function process_directory --description '处理目录'
        set -l dir $argv[1]
        
        if test "$recursive" = "true"
            # 递归处理
            find $dir -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.mp4" -o -name "*.avi" -o -name "*.mov" -o -name "*.mkv" -o -name "*.webm" \) | while read -l file
                convert_single_file "$file"
            end
        else
            # 只处理当前目录
            for file in $dir/*
                if test -f "$file"
                    set -l extension (echo $file | sed 's/.*\./' | tr '[:upper:]' '[:lower:]')
                    if contains $extension $image_extensions $video_extensions
                        convert_single_file "$file"
                    end
                end
            end
        end
    end

    # 处理输入参数
    for input in $argv
        if test -f "$input"
            convert_single_file "$input"
        else if test -d "$input"
            process_directory "$input"
        else
            echo "警告: 跳过不存在的文件或目录: $input"
        end
    end

    echo ""
    echo "转换完成! 输出文件保存在: $output_dir"
end

# 如果脚本被直接执行，调用主函数
if test (status --is-interactive)
    echo "convert_to_avif 函数已加载。使用 'convert_to_avif --help' 查看用法。"
else
    convert_to_avif $argv
end