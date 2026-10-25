using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace FastGoLauncher {
 public sealed class Card : Panel {
  public Card() { BackColor=Color.FromArgb(24,31,34); Padding=new Padding(24); DoubleBuffered=true; }
  protected override void OnPaint(PaintEventArgs e) { base.OnPaint(e); using(var pen=new Pen(Color.FromArgb(44,55,58))) e.Graphics.DrawRectangle(pen,0,0,Width-1,Height-1); }
 }
 public sealed class Meter : Control {
  int percent;
  public int Percent { get { return percent; } set { percent=Math.Max(0,Math.Min(100,value)); Invalidate(); } }
  public Meter() { Height=8; DoubleBuffered=true; }
  protected override void OnPaint(PaintEventArgs e) { using(var b=new SolidBrush(Color.FromArgb(47,59,60))) e.Graphics.FillRectangle(b,ClientRectangle); using(var b=new SolidBrush(Color.FromArgb(185,241,105))) e.Graphics.FillRectangle(b,0,0,Width*percent/100,Height); }
 }
 public sealed class MainForm : Form {
  static readonly Color Background=Color.FromArgb(15,21,23),TextPrimary=Color.FromArgb(241,245,241),Muted=Color.FromArgb(156,171,174),Accent=Color.FromArgb(185,241,105);
  readonly Network network=new Network(); readonly Updater updater; readonly Diagnostics diagnostics;
  readonly Label installedLabel,latestLabel,headline,description,progressText,diagSummary;
  readonly Button action,check,open,diagnose,cancel,export,jarvis;
  readonly TextBox diagnosticText;
  readonly Meter meter;
  readonly List<Probe> probes=new List<Probe>();
  CancellationTokenSource operation; Release release; string downloaded=""; bool busy;
  string smokeDirectory; bool repairing;
  public MainForm(string smokeDirectory) {
   this.smokeDirectory=smokeDirectory; updater=new Updater(network); diagnostics=new Diagnostics(network,updater);
   Text="FastGo Склад · Лаунчер"; BackColor=Background; ForeColor=TextPrimary; Font=new Font("Segoe UI",10); AutoScaleMode=AutoScaleMode.Dpi;
   ClientSize=new Size(980,680); MinimumSize=new Size(920,700); StartPosition=FormStartPosition.CenterScreen;
   try { Icon=System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
   var root=new TableLayoutPanel { Dock=DockStyle.Fill,Padding=new Padding(30,24,30,16),ColumnCount=1,RowCount=3,BackColor=Background };
   root.RowStyles.Add(new RowStyle(SizeType.Absolute,100)); root.RowStyles.Add(new RowStyle(SizeType.Percent,100)); root.RowStyles.Add(new RowStyle(SizeType.Absolute,48)); Controls.Add(root);
   var header=new Panel { Dock=DockStyle.Fill };
   var mark=Label("F",22,FontStyle.Bold,Background); mark.Dock=DockStyle.None; mark.BackColor=Accent; mark.TextAlign=ContentAlignment.MiddleCenter; mark.SetBounds(0,8,58,58); header.Controls.Add(mark);
   var title=Label("FastGo Склад",24,FontStyle.Bold,TextPrimary); title.Dock=DockStyle.None; title.SetBounds(76,2,500,43); header.Controls.Add(title);
   var subtitle=Label("Обновления и диагностика сети",10,FontStyle.Regular,Muted); subtitle.Dock=DockStyle.None; subtitle.SetBounds(79,49,500,26); header.Controls.Add(subtitle);
   var version=Label("ЛАУНЧЕР  "+Settings.LauncherVersion,9,FontStyle.Bold,Muted); version.Dock=DockStyle.Right; version.Width=180; version.TextAlign=ContentAlignment.TopRight; version.Padding=new Padding(0,30,0,0); header.Controls.Add(version); root.Controls.Add(header,0,0);
   var columns=new TableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=2,RowCount=1,Margin=Padding.Empty };
   columns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,53)); columns.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,47)); root.Controls.Add(columns,0,1);
   var updateCard=new Card { Dock=DockStyle.Fill,Margin=new Padding(0,0,14,0) }; columns.Controls.Add(updateCard,0,0);
   var layout=new TableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=1,RowCount=10,Margin=Padding.Empty };
   int[] heights={28,62,22,68,66,36,12,40,48,0};
   for(int i=0;i<heights.Length;i++) layout.RowStyles.Add(new RowStyle(i==9?SizeType.Percent:SizeType.Absolute,i==9?100:heights[i]));
   updateCard.Controls.Add(layout);
   layout.Controls.Add(Label("ОБНОВЛЕНИЕ ПРИЛОЖЕНИЯ",9,FontStyle.Bold,Muted),0,0);
   var versions=new TableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=2,RowCount=2,Margin=Padding.Empty }; versions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50)); versions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
   versions.Controls.Add(Label("Установлено",9,FontStyle.Regular,Muted),0,0); versions.Controls.Add(Label("Доступно",9,FontStyle.Regular,Muted),1,0);
   installedLabel=Label("—",17,FontStyle.Bold,TextPrimary); latestLabel=Label("Проверяем…",17,FontStyle.Bold,Accent); versions.Controls.Add(installedLabel,0,1); versions.Controls.Add(latestLabel,1,1); layout.Controls.Add(versions,0,1);
   headline=Label("Проверяем обновления",18,FontStyle.Bold,TextPrimary); layout.Controls.Add(headline,0,3);
   description=Label("Подключаемся к официальному каналу FastGo.",10,FontStyle.Regular,Muted); layout.Controls.Add(description,0,4);
   progressText=Label("",9,FontStyle.Regular,Muted); layout.Controls.Add(progressText,0,5);
   meter=new Meter { Dock=DockStyle.Fill,Margin=new Padding(0,2,0,4) }; layout.Controls.Add(meter,0,6);
   cancel=Button("Отменить",false); cancel.Visible=false; cancel.Click+=(s,e)=>{ if(operation!=null) operation.Cancel(); }; cancel.Dock=DockStyle.Right; cancel.Width=120; layout.Controls.Add(cancel,0,7);
   action=Button("Скачать обновление",true); action.Click+=async(s,e)=>{ if(downloaded!="") Install(); else await Download(); }; action.Dock=DockStyle.Fill; layout.Controls.Add(action,0,8);
   var actions=new FlowLayoutPanel { Dock=DockStyle.Fill,FlowDirection=FlowDirection.LeftToRight,Margin=new Padding(0,12,0,0),WrapContents=true };
   check=Button("Проверить версию",false); check.Width=172; check.Click+=async(s,e)=>await Check(); open=Button("Открыть склад",false); open.Width=160; open.Click+=(s,e)=>OpenWarehouse(); actions.Controls.Add(check); actions.Controls.Add(open); layout.Controls.Add(actions,0,9);
   var diagCard=new Card { Dock=DockStyle.Fill,Margin=Padding.Empty }; columns.Controls.Add(diagCard,1,0);
   var diagLayout=new TableLayoutPanel { Dock=DockStyle.Fill,ColumnCount=1,RowCount=6,Margin=Padding.Empty }; diagLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,40)); diagLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,50)); diagLayout.RowStyles.Add(new RowStyle(SizeType.Percent,100)); diagLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,48)); diagLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,44)); diagLayout.RowStyles.Add(new RowStyle(SizeType.Absolute,44)); diagCard.Controls.Add(diagLayout);
   diagLayout.Controls.Add(Label("Проверка связи",17,FontStyle.Bold,TextPrimary),0,0);
   diagSummary=Label("Если обновление не скачивается, найдём причину.",10,FontStyle.Regular,Muted); diagLayout.Controls.Add(diagSummary,0,1);
   diagnosticText=new TextBox { Dock=DockStyle.Fill,Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,BorderStyle=BorderStyle.None,BackColor=diagCard.BackColor,ForeColor=Muted,Font=new Font("Segoe UI",9),Text="Проверяем по шагам\r\n\r\n• Подключение Windows\r\n• DNS серверов обновлений\r\n• Соединение HTTPS\r\n• Канал обновлений\r\n• Доступность установщика\r\n• Место на диске и прокси",TabStop=true,Margin=new Padding(0,12,0,8) }; diagLayout.Controls.Add(diagnosticText,0,2);
   diagnose=Button("Проверить сеть",false); diagnose.Dock=DockStyle.Fill; diagnose.Click+=async(s,e)=>await Diagnose(); diagLayout.Controls.Add(diagnose,0,3);
   export=Button("Сохранить отчёт",false); export.Dock=DockStyle.Fill; export.Enabled=false; export.Click+=(s,e)=>SaveReport(); diagLayout.Controls.Add(export,0,4);
   jarvis=Button("Убрать окна JARVIS",false); jarvis.Dock=DockStyle.Fill; jarvis.Click+=async(s,e)=>await RepairJarvis(); diagLayout.Controls.Add(jarvis,0,5);
   var footer=new Panel { Dock=DockStyle.Fill };
   var safety=Label("SHA-512 · Докачка после обрыва · Установка по кнопке",8,FontStyle.Regular,Muted); safety.Dock=DockStyle.None; safety.SetBounds(0,18,600,25); footer.Controls.Add(safety);
   var log=new LinkLabel { Text="Журнал",AutoSize=false,Width=70,Dock=DockStyle.Right,TextAlign=ContentAlignment.MiddleRight,LinkColor=Muted,ActiveLinkColor=Accent,VisitedLinkColor=Muted }; log.LinkClicked+=(s,e)=>{ Directory.CreateDirectory(Settings.Logs); Process.Start(new ProcessStartInfo(Settings.Logs) { UseShellExecute=true }); }; footer.Controls.Add(log); root.Controls.Add(footer,0,2);
   Shown+=async(s,e)=>{ await Check(); if(this.smokeDirectory!=null) await Smoke(); };
   FormClosing+=(s,e)=>{ if(repairing) { e.Cancel=true; return; } if(operation!=null) operation.Cancel(); };
   if(smokeDirectory!=null) { StartPosition=FormStartPosition.Manual; Location=new Point(-20000,-20000); ShowInTaskbar=false; }
  }
  static Label Label(string text,float size,FontStyle style,Color color) { return new Label { Text=text,Font=new Font("Segoe UI",size,style),ForeColor=color,Dock=DockStyle.Fill,AutoSize=false,Margin=Padding.Empty,UseMnemonic=false }; }
  static Button Button(string text,bool primary) {
   var button=new Button { Text=text,FlatStyle=FlatStyle.Flat,Height=40,Font=new Font("Segoe UI",10,primary?FontStyle.Bold:FontStyle.Regular),BackColor=primary?Accent:Color.FromArgb(31,41,44),ForeColor=primary?Background:TextPrimary,Cursor=Cursors.Hand,Margin=new Padding(0,4,8,4),UseVisualStyleBackColor=false };
   button.FlatAppearance.BorderColor=primary?Accent:Color.FromArgb(55,69,72); button.FlatAppearance.BorderSize=primary?0:1; return button;
  }
  void Busy(bool value) { busy=value; action.Enabled=!value&&release!=null; check.Enabled=!value; diagnose.Enabled=!value; jarvis.Enabled=!value; open.Enabled=!value&&Installation.Find().Path!=""; cancel.Visible=value; }
  CancellationToken Begin() { operation=new CancellationTokenSource(); Busy(true); return operation.Token; }
  void End() { Busy(false); if(operation!=null) { operation.Dispose(); operation=null; } }
  async Task Check() {
   if(busy) return; var token=Begin(); downloaded=""; release=null; meter.Percent=0;
   headline.Text="Проверяем обновления"; description.Text="Получаем актуальную версию FastGo Склад."; progressText.Text=""; latestLabel.Text="Проверяем…";
   var installed=Installation.Find(); installedLabel.Text=installed.Version==""?"Не найден":installed.Version;
   try {
    release=await updater.Latest(token); latestLabel.Text=release.Version;
    string final=Path.Combine(Settings.Downloads,release.FileName);
    bool same=installed.Version!="" && new Version(installed.Version)>=new Version(release.Version);
    if(await Task.Run(()=>Updater.Verify(final,release),token)) downloaded=final;
    headline.Text=same?"Склад обновлён":"Доступна новая версия";
    description.Text=same?"У вас установлена актуальная или более новая версия. При необходимости можно скачать установщик повторно.":"Скачайте обновление. После проверки файла появится кнопка установки.";
    progressText.Text=Format.Bytes(release.Size)+" · "+release.Source;
    action.Text=downloaded!=""?"Установить "+release.Version:same?"Скачать установщик":"Скачать обновление";
    if(downloaded!="") { headline.Text="Установщик готов"; meter.Percent=100; description.Text="Целостность файла проверена. Завершите работу в складе перед установкой."; }
    Log.Write("Доступная версия "+release.Version+", установленная "+installed.Version);
   } catch(Exception e) { release=null; latestLabel.Text="Нет связи"; headline.Text="Не удалось проверить"; description.Text=Format.Error(e); progressText.Text="Нажмите «Проверить сеть» для диагностики."; Log.Write("Проверка: "+Format.Error(e)); }
   finally { End(); }
  }
  async Task Download() {
   if(busy || release==null) return; var token=Begin(); headline.Text="Загружаем обновление"; description.Text="При обрыве связи загрузка продолжится с сохранённого места.";
   try {
    downloaded=await updater.Download(release,Settings.Downloads,new Progress<Transfer>(p=>{ meter.Percent=p.Percent; progressText.Text=p.Message=="Скачивание обновления"?p.Percent+"% · "+Format.Bytes(p.Received)+" / "+Format.Bytes(p.Total)+" · "+Format.Bytes(p.BytesPerSecond)+"/с":p.Message; }),token);
    headline.Text="Готово к установке"; description.Text="Файл проверен по SHA-512. Завершите работу в складе и нажмите «Установить»."; progressText.Text="Проверено · "+Format.Bytes(release.Size); meter.Percent=100; action.Text="Установить "+release.Version;
   } catch(Exception e) { downloaded=""; headline.Text=token.IsCancellationRequested?"Загрузка приостановлена":"Загрузка не завершена"; description.Text=Format.Error(e); progressText.Text="Сохранённую часть докачаем при следующей попытке."; action.Text="Продолжить загрузку"; Log.Write(Format.Error(e)); }
   finally { End(); }
  }
  async Task Diagnose() {
   if(busy) return; var token=Begin(); probes.Clear(); diagnosticText.Clear(); diagSummary.Text="Проверяем подключение и серверы…";
   var progress=new Progress<Probe>(p=>{ probes.Add(p); diagnosticText.AppendText((p.Ok?"✓  ":"!  ")+p.Name+"\r\n"+p.Detail+(p.Milliseconds>0?" · "+p.Milliseconds+" мс":"")+"\r\n\r\n"); });
   try { var result=await Task.Run(()=>diagnostics.Run(p=>((IProgress<Probe>)progress).Report(p),token)); diagSummary.Text=result.All(p=>p.Ok)?"Всё доступно. Можно загружать обновление.":"Есть проблема. Подробности — ниже в отчёте."; Log.Write(Diagnostics.Report(result)); }
   catch(Exception e) { diagSummary.Text=Format.Error(e); }
   finally { End(); export.Enabled=probes.Count>0; diagnosticText.SelectionStart=0; diagnosticText.ScrollToCaret(); }
  }
  async Task RepairJarvis() {
   if(busy) return; Begin(); repairing=true; cancel.Visible=false; diagSummary.Text="Исправляем фоновый запуск JARVIS…";
   try { string result=await JarvisRepair.Run(true); diagSummary.Text="JARVIS: скрытый запуск настроен"; diagnosticText.Text=result; probes.Add(new Probe { Name="Исправление JARVIS",Ok=true,Detail=result }); }
   catch(Exception e) { diagSummary.Text="JARVIS: исправление не применено"; diagnosticText.Text=Format.Error(e); Log.Write("JARVIS: "+Format.Error(e)); }
   finally { repairing=false; End(); export.Enabled=probes.Count>0; }
  }
  async void Install() {
   if(busy || downloaded=="" || release==null) return;
   var installed=Installation.Find();
   if(Installation.Running(installed)) { headline.Text="Сначала закройте склад"; description.Text="Завершите текущие документы и закройте FastGo Склад, включая значок в трее. Затем повторите установку."; return; }
   if(installed.Version!="" && new Version(installed.Version)>new Version(release.Version)) { headline.Text="Установлена более новая версия"; description.Text="Понижение версии заблокировано. Проверьте обновления ещё раз."; return; }
   var token=Begin();
   try {
    if(!await Task.Run(()=>Updater.Verify(downloaded,release),token)) throw new InvalidDataException("Файл изменился после загрузки. Скачайте установщик заново.");
    if(Installation.Running(Installation.Find())) throw new InvalidOperationException("FastGo Склад открыт. Закройте приложение перед установкой.");
    Process.Start(new ProcessStartInfo(downloaded) { UseShellExecute=true,WorkingDirectory=Settings.Downloads });
    headline.Text="Установщик запущен"; description.Text="Пройдите шаги установки. После завершения склад можно открыть кнопкой ниже."; Log.Write("Пользователь запустил установщик "+release.Version);
   } catch(Exception e) { headline.Text="Установка не запущена"; description.Text=Format.Error(e); }
   finally { End(); }
  }
  void OpenWarehouse() { try { var installed=Installation.Find(); if(installed.Path=="") throw new FileNotFoundException("FastGo Склад пока не установлен."); Process.Start(new ProcessStartInfo(installed.Path) { UseShellExecute=true,WorkingDirectory=Path.GetDirectoryName(installed.Path) }); } catch(Exception e) { description.Text=Format.Error(e); } }
  void SaveReport() { using(var dialog=new SaveFileDialog { Filter="Текстовый отчёт (*.txt)|*.txt",FileName="FastGo-network-"+DateTime.Now.ToString("yyyy-MM-dd-HHmm")+".txt" }) if(dialog.ShowDialog(this)==DialogResult.OK) { try { File.WriteAllText(dialog.FileName,Diagnostics.Report(probes),System.Text.Encoding.UTF8); } catch(Exception e) { diagSummary.Text=Format.Error(e); } } }
  async Task Smoke() {
   try {
    await Diagnose(); await Task.Delay(250); Directory.CreateDirectory(smokeDirectory);
    using(var bitmap=new Bitmap(Width,Height)) { DrawToBitmap(bitmap,new Rectangle(0,0,Width,Height)); bitmap.Save(Path.Combine(smokeDirectory,"launcher.png"),System.Drawing.Imaging.ImageFormat.Png); }
    var installed=Installation.Find();
    File.WriteAllText(Path.Combine(smokeDirectory,"ui-verification.json"),new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(new { launcher=Settings.LauncherVersion,native_process=true,feed_version=release==null?"":release.Version,installed_version=installed.Version,download_button_enabled=action.Enabled,network_checks=probes.Count,network_errors=probes.Count(p=>!p.Ok),jarvis_button_enabled=jarvis.Enabled,jarvis_resource_embedded=typeof(JarvisRepair).Assembly.GetManifestResourceNames().Contains("FastGo.JarvisRepair"),width=Width,height=Height,automatic_install=false }));
   } catch(Exception e) { File.WriteAllText(Path.Combine(smokeDirectory,"ui-error.txt"),e.ToString()); }
   finally { Close(); }
  }
 }
}
