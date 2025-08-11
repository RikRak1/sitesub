import os
import tempfile
import time
import subprocess
import whisper
import numpy as np
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from moviepy.editor import VideoFileClip
from resemblyzer import VoiceEncoder, preprocess_wav
from sklearn.cluster import AgglomerativeClustering
from collections import Counter
import concurrent.futures
import threading
import shutil
import logging
import traceback
import hashlib
import mimetypes
import uuid
import subprocess
from werkzeug.utils import secure_filename
import shlex  

def delayed_delete(path, delay=10):
    def delete_task():
        for _ in range(5):
            try:
                if os.path.exists(path):
                    shutil.rmtree(path, ignore_errors=True)
                    logger.info(f"Объект удалён: {path}")
                    break
            except Exception as e:
                logger.warning(f"Ошибка удаления {path}, попытка {_+1}: {str(e)}")
                time.sleep(delay * (_ + 1))
    
    thread = threading.Thread(target=delete_task)
    thread.daemon = True
    thread.start()

# Расширенная настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log', mode='a', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = ['af', 'ar', 'hy', 'az', 'be', 'bs', 'bg', 'ca', 'zh', 'hr', 
'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'gl', 'de', 'el', 'he', 'hi', 'hu', 'is', 'id', 
'it', 'ja', 'kn', 'kk', 'ko', 'lv', 'lt', 'mk', 'ms', 'mr', 'mi', 'ne', 'no', 'fa', 'pl', 
'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw', 'sv', 'tl', 'ta', 'th', 'tr', 'uk', 'ur', 
'vi', 'cy']

# Инициализация Flask
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.config['MAX_CONTENT_LENGTH'] = 5000 * 1024 * 1024

# Глобальная загрузка моделей (кеширование)
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
encoder = VoiceEncoder()
models = {}

# Импорт sampling_rate из resemblyzer.hparams
from resemblyzer.hparams import sampling_rate

def load_models():
    logger.info("Предварительная загрузка моделей Whisper...")
    model_sizes = ["base", "medium"]
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {executor.submit(whisper.load_model, size): size for size in model_sizes}
        
        for future in concurrent.futures.as_completed(futures):
            model_size = futures[future]
            try:
                models[model_size] = future.result()
                logger.info(f"Загружена модель Whisper: {model_size}")
            except Exception as e:
                logger.error(f"Ошибка загрузки модели {model_size}: {str(e)}")

load_models()

def validate_file(file_stream):
    try:
        file_stream.seek(0)
        header = file_stream.read(1024)
        file_stream.seek(0)
        
        # Расширенная проверка для видеоформатов
        if b"ftyp" in header: 
            return "mp4"
        elif b"RIFF" in header and b"AVI " in header: 
            return "avi"
        elif b"ftypqt" in header: 
            return "mov"
        elif b"matroska" in header: 
            return "mkv"
        elif header.startswith(b'\x00\x00\x00 ftyp'):
            return "mp4"
        elif header.startswith(b'\x1aE\xdf\xa3') and header.find(b'matroska') != -1:
            return "mkv"
        
    except Exception as e:
        logger.error(f"Ошибка валидации файла: {str(e)}")
    return None

def extract_audio(video_stream, audio_path):
    try:
        # Создаем уникальное имя для временного файла
        temp_video_name = f"temp_{uuid.uuid4().hex}.mp4"
        temp_video_path = os.path.join(tempfile.gettempdir(), temp_video_name)
        
        # Сохраняем видеофайл
        with open(temp_video_path, 'wb') as f:
            video_stream.save(f)
            
        logger.info(f"Временный видеофайл сохранён: {temp_video_path}")
        
        # Извлекаем аудио с помощью FFmpeg
        try:
            # Находим путь к FFmpeg
            ffmpeg_path = "ffmpeg"
            
            command = [
                ffmpeg_path,
                "-i", temp_video_path,
                "-vn",             
                "-acodec", "pcm_s16le",  
                "-ar", str(sampling_rate),  
                "-ac", "1",         
                "-y",               
                audio_path
            ]
            
            logger.info(f"Выполняем команду извлечения: {' '.join(command)}")
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            if result.returncode != 0:
                error_message = result.stderr.decode('utf-8')
                logger.error(f"Ошибка FFmpeg при извлечении аудио: {error_message}")
                raise RuntimeError(f"FFmpeg error: {error_message}")
                
            logger.info(f"Аудиофайл успешно извлечён: {audio_path} - размер: {os.path.getsize(audio_path)} байт")
            
            return audio_path
        finally:
            # Гарантированное удаление временного файла с повторными попытками
            def safe_delete(path, max_attempts=5, delay=0.2):
                for attempt in range(max_attempts):
                    try:
                        if os.path.exists(path):
                            os.remove(path)
                            logger.info(f"Удалён временный файл: {path}")
                            return True
                    except PermissionError as pe:
                        logger.warning(f"Попытка {attempt+1}/{max_attempts}: файл занят, повтор через {delay}сек")
                        time.sleep(delay)
                    except Exception as e:
                        logger.error(f"Неожиданная ошибка при удалении: {str(e)}")
                        return False
                logger.error(f"Не удалось удалить {path} после {max_attempts} попыток")
                return False
            
            safe_delete(temp_video_path)
                
    except Exception as e:
        logger.error(f"Ошибка извлечения аудио: {str(e)}", exc_info=True)
        # Удаляем возможный частичный аудиофайл
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except:
                pass
        raise

def transcribe_audio(audio_path, model_size="base", language=None, translate=False):
    try:
        model = models.get(model_size)
        if not model:
            logger.info(f"Загружаю модель Whisper: {model_size}")
            model = whisper.load_model(model_size)
            models[model_size] = model
        
        task = "translate" if translate else "transcribe"
        result = model.transcribe(audio_path, word_timestamps=True, language=language, task=task)
        
        if not result.get("segments"):
            logger.warning(f"Транскрипция не вернула сегменты: {audio_path}")
            
        return result.get("segments", [])
    except Exception as e:
        logger.error(f"Ошибка транскрипции: {str(e)}")
        raise

def split_long_segments(segments, max_duration=2.0):
    split_segs = []
    for seg in segments:
        start, end = seg["start"], seg["end"]
        text = seg["text"]
        
        if end <= start:
            continue
            
        total_duration = end - start
        if total_duration <= 0:
            continue
            
        num_segments = max(1, int(total_duration / max_duration) + 1)
        segment_duration = total_duration / num_segments
        
        for i in range(num_segments):
            seg_start = start + i * segment_duration
            seg_end = min(start + (i + 1) * segment_duration, end)
            split_segs.append({
                "start": seg_start,
                "end": seg_end,
                "text": text if num_segments == 1 else f"[{i+1}/{num_segments}] {text}"
            })
    
    return split_segs

def diarize(audio_path, segments, num_speakers=None):
    try:
        wav = preprocess_wav(audio_path)
        window_size = 1.0
        step_size = 0.25
        duration = len(wav) / sampling_rate

        embeddings = []
        mid_times = []

        # Защита от слишком коротких аудио
        if duration < window_size:
            return []
            
        for current_time in np.arange(0.0, duration - window_size + 0.25, step_size):
            start_sample = int(current_time * sampling_rate)
            end_sample = int((current_time + window_size) * sampling_rate)
            
            if end_sample > len(wav):
                end_sample = len(wav)
                
            if start_sample >= end_sample:
                continue
                
            partial = wav[start_sample:end_sample]

            if partial.size == 0 or np.mean(np.abs(partial)) < 0.001:
                continue

            embed = encoder.embed_utterance(partial)
            embeddings.append(embed)
            mid_times.append(current_time + window_size / 2)

        if not embeddings:
            return []

        if num_speakers is None or num_speakers < 1:
            num_speakers = 2
        elif num_speakers > 10:
            num_speakers = 10

        clustering = AgglomerativeClustering(n_clusters=num_speakers).fit(embeddings)
        labels = clustering.labels_

        seg_speakers = []
        for seg in segments:
            seg_start, seg_end = seg["start"], seg["end"]
            seg_labels = []
            
            for i, t in enumerate(mid_times):
                if seg_start <= t <= seg_end:
                    if i < len(labels):
                        seg_labels.append(labels[i])
            
            if seg_labels:
                label_counts = Counter(seg_labels)
                best_label = label_counts.most_common(1)[0][0] if label_counts else None
            else:
                best_label = None

            seg_speakers.append((seg_start, seg_end, best_label))
        
        logger.info(f"Диакризация успешно завершена для {len(segments)} сегментов")
        return seg_speakers
    except Exception as e:
        logger.error(f"Ошибка диакризации: {str(e)}")
        return []

def assign_speakers(segments, diarization):
    assigned_segments = []
    
    if not diarization:
        for seg in segments:
            seg["speaker"] = "Speaker?"
            assigned_segments.append(seg)
        return assigned_segments
        
    for seg in segments:
        seg_start, seg_end = seg["start"], seg["end"]
        matches = []
        
        for d_start, d_end, spk in diarization:
            if d_end < seg_start or d_start > seg_end:
                continue
            overlap = min(seg_end, d_end) - max(seg_start, d_start)
            if overlap > 0:
                matches.append((overlap, spk))
        
        if matches:
            matches.sort(key=lambda x: x[0], reverse=True)
            best_spk = matches[0][1]
            speaker_label = f"Speaker {best_spk + 1}" if best_spk is not None else "Speaker?"
        else:
            speaker_label = "Speaker?"
        
        seg["speaker"] = speaker_label
        assigned_segments.append(seg)
    
    return assigned_segments

def generate_subtitle_content(segments, subtitle_format="srt"):
    if not segments:
        return ""
        
    def format_time(t):
        h, m = divmod(int(t), 3600)
        m, s = divmod(m, 60)
        ms = int((t - int(t)) * 1000)
        return f"{h:02}:{m:02}:{s:02},{ms:03}"
    
    content = ""
    
    if subtitle_format == "srt":
        for i, seg in enumerate(segments, 1):
            if "text" not in seg or "start" not in seg or "end" not in seg:
                continue
                
            content += f"{i}\n"
            content += f"{format_time(seg['start'])} --> {format_time(seg['end'])}\n"
            speaker = seg.get("speaker", "Speaker?")
            content += f"{speaker}: {seg['text']}\n\n"
    
    elif subtitle_format == "vtt":
        content = "WEBVTT\n\n"
        for i, seg in enumerate(segments, 1):
            if "text" not in seg or "start" not in seg or "end" not in seg:
                continue
                
            content += f"{i}\n"
            start_str = format_time(seg['start']).replace(',', '.')
            end_str = format_time(seg['end']).replace(',', '.')
            content += f"{start_str} --> {end_str}\n"
            speaker = seg.get("speaker", "Speaker?")
            content += f"{speaker}: {seg['text']}\n\n"
    
    elif subtitle_format == "txt":
        for seg in segments:
            if "text" not in seg or "start" not in seg or "end" not in seg:
                continue
                
            start_str = format_time(seg['start'])
            end_str = format_time(seg['end'])
            speaker = seg.get("speaker", "Speaker?")
            content += f"{start_str} - {end_str}\t{speaker}:\t{seg['text']}\n"
    
    return content

def generate_video_with_subs_background(video_path, subs_path, output_path, subs_format, language="rus", burn_in=False):
    try:
        if burn_in:
            # Жёсткое наложение субтитров на видео
            command = [
                'ffmpeg',
                '-i', video_path,
                '-vf', f"subtitles={os.path.basename(subs_path)}", 
                '-preset', 'veryfast',  
                '-crf', '23',          
                '-c:a', 'copy',        
                '-y',                  
                output_path
            ]
            
            # Добавляем метаданные языка для видео
            command.extend([
                '-metadata', f'language={language}',
            ])
        else:
            # Мягкое добавление субтитров (отдельная дорожка)
            subtitle_codec = {
                'srt': 'srt',
                'vtt': 'webvtt',
            }.get(subs_format.lower())
            
            if not subtitle_codec:
                raise ValueError(f"Unsupported subtitle format for embedding: {subs_format}")
            
            command = [
                'ffmpeg',
                '-i', video_path,
                '-i', subs_path,
                '-c:v', 'copy',        
                '-c:a', 'copy',        
                '-c:s', subtitle_codec,
                '-map', '0',
                '-map', '1',
                '-disposition:s:0', 'default',
                '-metadata:s:s:0', f'language={language}',
                '-y',                 
                output_path
            ]
        
        logger.info(f"Выполняем команду: {subprocess.list2cmdline(command)}")
        
        # Запускаем FFmpeg из текущего каталога (для правильной работы с фильтрами)
        result = subprocess.run(
            command, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True,
            cwd=os.path.dirname(subs_path)  
        )
        
        if result.returncode != 0:
            error_message = result.stderr
            logger.error(f"Ошибка при обработке видео (код {result.returncode}): {error_message}")
            return False, f"Видео обработка ошибка: {error_message[:500]}"
            
        return True, output_path
    except Exception as e:
        logger.error(f"Ошибка обработки видео: {str(e)}", exc_info=True)
        return False, str(e)

@app.route('/generate-subtitles', methods=['POST'])
def generate_subtitles():
    request_id = uuid.uuid4().hex
    logger.info(f"[{request_id}] Начало обработки запроса")
    
    try:
        # Логирование заголовков запроса
        if request.headers:
            logger.info(f"[{request_id}] Заголовки запроса: {dict(request.headers)}")
        
        # Проверка наличия файла
        if 'video' not in request.files:
            error_msg = "No video file provided in form data"
            logger.error(f"[{request_id}] {error_msg}")
            return jsonify({
                "error": error_msg,
                "message": "Please upload a video file",
                "request_id": request_id
            }), 400
        
        video_file = request.files['video']
        logger.info(f"[{request_id}] Получен видеофайл: {video_file.filename}")
        
        # Валидация пустого файла
        if video_file.filename == '':
            error_msg = "Empty file name in request"
            logger.error(f"[{request_id}] {error_msg}")
            return jsonify({
                "error": "No selected file",
                "message": "Please select a valid video file",
                "request_id": request_id
            }), 400
        
        # Загрузка параметров из формы
        model_size = request.form.get('model_size', 'base')
        language = request.form.get('language', 'ru')
        
        if language == 'auto':
            logger.warning(f"[{request_id}] Обнаружен автоопределяемый язык. Заменяем на русский")
            language = 'ru'
        elif language not in SUPPORTED_LANGUAGES:
            logger.warning(f"[{request_id}] Неподдерживаемый язык '{language}'. Заменяем на русский")
            language = 'ru'
        
        translate = request.form.get('translate', 'false').lower() == 'true'
        subtitle_format = request.form.get('format', 'srt')
        num_speakers = request.form.get('num_speakers')
        
        logger.info(f"[{request_id}] Параметры запроса:")
        logger.info(f"  model_size: {model_size}")
        logger.info(f"  language: {language}")
        logger.info(f"  translate: {translate}")
        logger.info(f"  subtitle_format: {subtitle_format}")
        logger.info(f"  num_speakers: {num_speakers}")
        
        # Конвертация параметров числовых значений
        if num_speakers:
            try:
                num_speakers = int(num_speakers)
            except ValueError:
                num_speakers = None
        
        # Сохранить файл во временное место для анализа
        video_file.seek(0)
        file_content = video_file.read(1024 * 1024) 
        video_file.seek(0)
        
        # Определение типа файла
        file_extension = video_file.filename.split('.')[-1].lower() if '.' in video_file.filename else ''
        logger.info(f"[{request_id}] Расширение файла: {file_extension}")
        
        # Проверяем расширение файла
        valid_extensions = ["mp4", "avi", "mov", "mkv"]
        if file_extension not in valid_extensions:
            error_msg = f"File extension {file_extension} not supported"
            logger.error(f"[{request_id}] {error_msg}")
            return jsonify({
                "error": "Invalid file format",
                "message": f"Unsupported file extension: {file_extension}",
                "supported": "Supported formats: MP4, AVI, MOV, MKV",
                "file_extension": file_extension,
                "request_id": request_id
            }), 400
        
        file_type = validate_file(video_file)
        logger.info(f"[{request_id}] Определённый тип файла: {file_type}")
        
        if not file_type:
            error_msg = "File format not recognized by signature"
            logger.error(f"[{request_id}] {error_msg}")
            return jsonify({
                "error": "Unsupported file format",
                "message": "Could not recognize file signature format",
                "supported": "Supported formats: MP4, AVI, MOV, MKV",
                "file_extension": file_extension,
                "request_id": request_id
            }), 400
        
        # Работа с временным каталогом
        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info(f"[{request_id}] Создан временный каталог: {temp_dir}")
            
            # Создаем путь для аудиофайла
            audio_path = os.path.join(temp_dir, "audio.wav")
            logger.info(f"[{request_id}] Путь для аудиофайла: {audio_path}")
            
            # Извлечение аудио
            try:
                extract_audio(video_file, audio_path)
                
                # Проверка существования аудиофайла
                if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 1024:
                    error_msg = "Failed to extract valid audio from video"
                    logger.error(f"[{request_id}] {error_msg}")
                    return jsonify({
                        "error": "Audio extraction error",
                        "message": "Could not extract valid audio from video file",
                        "request_id": request_id
                    }), 400
            except Exception as audio_err:
                logger.error(f"[{request_id}] Ошибка извлечения аудио: {str(audio_err)}")
                return jsonify({
                    "error": "Processing error",
                    "message": "Failed to process video file",
                    "details": str(audio_err),
                    "request_id": request_id
                }), 500
            
            # Транскрипция аудио
            try:
                segments = transcribe_audio(audio_path, model_size, language, translate)
                logger.info(f"[{request_id}] Получено {len(segments)} транскрибированных сегментов")
                
                if not segments:
                    error_msg = "No transcribed segments returned"
                    logger.error(f"[{request_id}] {error_msg}")
                    return jsonify({
                        "error": "Transcription failed",
                        "message": "Audio transcription returned no segments",
                        "request_id": request_id
                    }), 500
                    
                segments = split_long_segments(segments)
            except Exception as transcribe_err:
                logger.error(f"[{request_id}] Ошибка транскрипции: {str(transcribe_err)}")
                return jsonify({
                    "error": "Transcription error",
                    "message": "Failed to transcribe audio",
                    "details": str(transcribe_err),
                    "request_id": request_id
                }), 500
            
            # Диакризация
            diarization = []
            duration = max(segment["end"] for segment in segments) if segments else 0
            
            try:
                if duration > 10:
                    diarization = diarize(audio_path, segments, num_speakers)
                    logger.info(f"[{request_id}] Диакризация завершена: {len(diarization)} результатов")
                else:
                    logger.info(f"[{request_id}] Пропуск диакризации для короткого видео")
            except Exception as diarize_err:
                logger.error(f"[{request_id}] Ошибка диакризации: {str(diarize_err)}")
                diarization = []
            
            try:
                segments = assign_speakers(segments, diarization)
                subtitle_content = generate_subtitle_content(segments, subtitle_format)
                
                if not subtitle_content:
                    error_msg = "Generated subtitles are empty"
                    logger.error(f"[{request_id}] {error_msg}")
                    return jsonify({
                        "error": "Subtitles generation failed",
                        "message": "Generated subtitles content is empty",
                        "request_id": request_id
                    }), 500
                    
                logger.info(f"[{request_id}] Успешно сгенерированы субтитры ({len(subtitle_content)} символов)")
                
                return jsonify({
                    "success": True,
                    "duration": f"{duration:.2f} seconds",
                    "segments_count": len(segments),
                    "format": subtitle_format,
                    "content": subtitle_content,
                    "speakers": (num_speakers if num_speakers else "auto"),
                    "file_type": file_type,
                    "file_extension": file_extension,
                    "request_id": request_id
                })
                
            except Exception as gen_err:
                logger.error(f"[{request_id}] Ошибка генерации субтитров: {str(gen_err)}")
                return jsonify({
                    "error": "Subtitles generation error",
                    "message": "Failed to generate subtitles content",
                    "details": str(gen_err),
                    "request_id": request_id
                }), 500
                
    except Exception as e:
        logger.error(f"[{request_id}] Критическая ошибка обработки: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Internal server error",
            "message": str(e),
            "request_id": request_id
        }), 500

@app.route('/generate-video-with-subs', methods=['POST'])
def generate_video_with_subs():
    temp_dir = None
    try:
        video_file = request.files['video']
        subs_content = request.form['subs_content']
        subs_format = request.form.get('subs_format', 'srt')
        language = request.form.get('language', 'rus')
        filename = secure_filename(video_file.filename)
        
        burn_in = True  
        
        temp_dir = tempfile.mkdtemp()
        logger.info(f"Создан временный каталог: {temp_dir}")
        
        base_filename = os.path.splitext(filename)[0]
        safe_base = base_filename.replace(' ', '_').replace('.', '_')[:50]
        
        video_path = os.path.join(temp_dir, f"{safe_base}_input.mp4")
        video_file.save(video_path)
        logger.info(f"Видео сохранено: {video_path}")
        
        subs_path = os.path.join(temp_dir, f"subs.srt") 
        
        if subs_format.lower() != "srt":
            original_subs_path = os.path.join(temp_dir, f"original_subs.{subs_format}")
            with open(original_subs_path, 'w', encoding='utf-8') as f:
                f.write(subs_content)
            
            try:
                with open(original_subs_path, 'r', encoding='utf-8') as src, open(subs_path, 'w', encoding='utf-8') as dst:
                    if subs_format.lower() == "txt":
                        for i, line in enumerate(src.readlines()):
                            dst.write(f"{i+1}\n{line}\n")
                    elif subs_format.lower() == "vtt":
                        content = src.read().replace("WEBVTT\n\n", "")
                        dst.write(content)
                
                logger.info(f"Субтитры сконвертированы в SRT")
            except Exception as conv_err:
                logger.error(f"Ошибка конвертации субтитров: {str(conv_err)}")
                return jsonify({
                    "error": "Subtitles conversion failed",
                    "details": str(conv_err)
                }), 500
        else:
            with open(subs_path, 'w', encoding='utf-8') as f:
                f.write(subs_content)
        
        logger.info(f"Субтитры сохранены: {subs_path}")
        
        output_ext = "mp4"
        output_filename = f"{safe_base}_with_hardcoded_subs.mp4"
        output_path = os.path.join(temp_dir, output_filename)
        
        success, result_path = generate_video_with_subs_background(
            video_path=video_path,
            subs_path=subs_path,
            output_path=output_path,
            subs_format='srt',  
            language=language,
            burn_in=burn_in
        )
        
        if not success:
            return jsonify({"error": result_path}), 500
        
        response = send_file(
            result_path,
            as_attachment=True,
            download_name=output_filename,
            mimetype='video/mp4'
        )
        
        delayed_delete(temp_dir)
        return response

    except Exception as e:
        logger.error(f"Ошибка в generate-video: {str(e)}", exc_info=True)
        if temp_dir:
            delayed_delete(temp_dir)
        return jsonify({
            "error": "Internal server error",
            "details": str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    models_loaded = []
    for model_size, model in models.items():
        models_loaded.append({
            "size": model_size,
            "loaded": model is not None
        })
    
    return jsonify({
        "status": "OK",
        "models_loaded": models_loaded,
        "python_environment": {
            "whisper_version": whisper.__version__ if hasattr(whisper, '__version__') else "unknown"
        }
    })

if __name__ == '__main__':
    logger.info("Запуск Flask сервера...")
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)