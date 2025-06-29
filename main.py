import os
from src.processing.data_processor import parse_afad_asc_file

def main():
    base_folder = "afad_downloads"
    subfolders = ["data", "data-2"]

    for subfolder in subfolders:
        folder_path = os.path.join(base_folder, subfolder)
        for filename in os.listdir(folder_path):
            if filename.endswith(".asc"):
                file_path = os.path.join(folder_path, filename)
                print(f"Parsing {file_path} ...")
                result = parse_afad_asc_file(file_path)
                print(result['metadata']['EVENT_NAME'], "parsed successfully")

if __name__ == "__main__":
    main()
