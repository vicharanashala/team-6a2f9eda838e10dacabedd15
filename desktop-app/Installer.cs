using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;
using System.Drawing;

namespace PrashnaSarathiInstaller
{
    public class Program
    {
        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }

    public class InstallerForm : Form
    {
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button installButton;

        public InstallerForm()
        {
            this.Text = "PrashnaSārathi Setup";
            this.Size = new Size(400, 220);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.FromArgb(12, 15, 23); 
            
            // Header Title
            Label titleLabel = new Label();
            titleLabel.Text = "Install PrashnaSārathi";
            titleLabel.Font = new Font("Segoe UI", 14, FontStyle.Bold);
            titleLabel.ForeColor = Color.White;
            titleLabel.Location = new Point(20, 20);
            titleLabel.Size = new Size(350, 30);
            this.Controls.Add(titleLabel);

            // Description Label
            Label descLabel = new Label();
            descLabel.Text = "This will install PrashnaSārathi to your computer and create shortcuts.";
            descLabel.Font = new Font("Segoe UI", 9);
            descLabel.ForeColor = Color.FromArgb(160, 166, 178);
            descLabel.Location = new Point(20, 55);
            descLabel.Size = new Size(350, 40);
            this.Controls.Add(descLabel);

            // Progress Bar
            progressBar = new ProgressBar();
            progressBar.Location = new Point(20, 105);
            progressBar.Size = new Size(345, 23);
            progressBar.Visible = false;
            this.Controls.Add(progressBar);

            // Status Label
            statusLabel = new Label();
            statusLabel.Font = new Font("Segoe UI", 8);
            statusLabel.ForeColor = Color.FromArgb(160, 166, 178);
            statusLabel.Location = new Point(20, 135);
            statusLabel.Size = new Size(350, 20);
            statusLabel.Visible = false;
            this.Controls.Add(statusLabel);

            // Install Button
            installButton = new Button();
            installButton.Text = "Install Now";
            installButton.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            installButton.ForeColor = Color.White;
            installButton.BackColor = Color.FromArgb(99, 102, 241); 
            installButton.FlatStyle = FlatStyle.Flat;
            installButton.FlatAppearance.BorderSize = 0;
            installButton.Location = new Point(265, 135);
            installButton.Size = new Size(100, 32);
            installButton.Click += new EventHandler(InstallButton_Click);
            this.Controls.Add(installButton);
        }

        private void InstallButton_Click(object sender, EventArgs e)
        {
            installButton.Visible = false;
            progressBar.Visible = true;
            statusLabel.Visible = true;
            statusLabel.Text = "Preparing installation...";
            progressBar.Value = 10;

            // Run in background thread to prevent UI freezing
            System.ComponentModel.BackgroundWorker worker = new System.ComponentModel.BackgroundWorker();
            worker.WorkerReportsProgress = true;
            worker.DoWork += (s, ev) => {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string destDir = Path.Combine(appData, "PrashnaSārathi");

                if (Directory.Exists(destDir))
                {
                    try {
                        Directory.Delete(destDir, true);
                    } catch {}
                }
                Directory.CreateDirectory(destDir);

                worker.ReportProgress(30, "Extracting files...");

                Assembly assembly = Assembly.GetExecutingAssembly();
                using (Stream stream = assembly.GetManifestResourceStream("app_bundle.zip"))
                {
                    if (stream == null)
                    {
                        throw new FileNotFoundException("Installer resources are missing.");
                    }

                    using (ZipArchive archive = new ZipArchive(stream))
                    {
                        int total = archive.Entries.Count;
                        int current = 0;
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            string destinationPath = Path.Combine(destDir, entry.FullName);
                            if (entry.Length == 0)
                            {
                                Directory.CreateDirectory(destinationPath);
                            }
                            else
                            {
                                Directory.CreateDirectory(Path.GetDirectoryName(destinationPath));
                                entry.ExtractToFile(destinationPath, true);
                            }
                            current++;
                            worker.ReportProgress(30 + (int)((double)current / total * 50), "Extracting " + entry.Name);
                        }
                    }
                }

                worker.ReportProgress(85, "Creating shortcuts...");
                CreateShortcut("PrashnaSārathi", Path.Combine(destDir, "PrashnaSārathi.exe"), destDir);

                worker.ReportProgress(100, "Done");
            };

            worker.ProgressChanged += (s, ev) => {
                progressBar.Value = ev.ProgressPercentage;
                if (ev.UserState != null) {
                    statusLabel.Text = ev.UserState.ToString();
                }
            };

            worker.RunWorkerCompleted += (s, ev) => {
                if (ev.Error != null)
                {
                    MessageBox.Show("An error occurred during installation:\n" + ev.Error.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                else
                {
                    MessageBox.Show("PrashnaSārathi has been successfully installed!\n\nYou can launch it from your Desktop or the Start Menu.", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                this.Close();
            };

            worker.RunWorkerAsync();
        }

        private void CreateShortcut(string name, string targetPath, string workDir)
        {
            string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string desktopShortcut = Path.Combine(desktopPath, name + ".lnk");
            SaveShortcut(desktopShortcut, targetPath, workDir);

            string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs));
            string startMenuShortcut = Path.Combine(startMenuPath, name + ".lnk");
            SaveShortcut(startMenuShortcut, targetPath, workDir);
        }

        private void SaveShortcut(string path, string targetPath, string workDir)
        {
            try {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(path);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = workDir;
                shortcut.Save();
            } catch {}
        }
    }
}
